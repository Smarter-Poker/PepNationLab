import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';
import { rateLimit, getClientIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const supabaseAuth = await createClient();
  const { data: { user } } = await supabaseAuth.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const ip = getClientIp(req);
  const rlMin = await rateLimit({ key: 'ai_stack_analysis_min', limit: 10, windowSeconds: 60, identifier: user.id || ip });
  const rlDaily = await rateLimit({ key: 'ai_stack_analysis_daily', limit: 30, windowSeconds: 86400, identifier: user.id || ip });
  if (!rlMin.allowed || !rlDaily.allowed) {
    return NextResponse.json({ error: 'Too Many Requests' }, { status: 429 });
  }

  try {
    if (!process.env.GROK_API_KEY) {
      return NextResponse.json({ error: 'GROK_API_KEY is not configured' }, { status: 501 });
    }

    const { slugs, names } = await req.json();
    if (!slugs && !names) {
      return NextResponse.json({ error: 'Provide either slugs or names' }, { status: 400 });
    }
    const rawIdentifiers = Array.isArray(slugs) ? slugs : Array.isArray(names) ? names : [];
    
    if (rawIdentifiers.length < 2 || rawIdentifiers.length > 10) {
      return NextResponse.json({ error: 'Requires 2 to 10 compounds for stack analysis' }, { status: 400 });
    }

    const SAFE_RE = /^[a-zA-Z0-9 _\-\.]+$/;
    if (!rawIdentifiers.every((id: unknown): id is string => typeof id === 'string' && id.length <= 100 && SAFE_RE.test(id))) {
      return NextResponse.json({ error: 'Invalid compound identifier format' }, { status: 400 });
    }
    const identifiers = rawIdentifiers as string[];

    const supabase = await createServiceClient();
    
    let query = supabase
      .from('compounds')
      .select('slug, display_name, mechanism, molecular_target, warnings, side_effects');

    // If slugs were passed use exact slug lookup; if names were passed use display_name lookup
    if (slugs) {
      query = query.in('slug', identifiers);
    } else {
      // Case-insensitive name match — storefront products use display_name directly
      query = query.or(identifiers.map(n => `display_name.ilike.${n}`).join(','));
    }

    const { data: compounds, error } = await query;

    if (error || !compounds || compounds.length < 2) {
      return NextResponse.json({ error: 'Failed to load compounds for analysis' }, { status: 404 });
    }

    const safeStr = (s: string | null, max = 500) => (s ?? '').replace(/[`${}\\]/g, '').slice(0, max);
    const compoundContext = compounds.map(c => 
      `Name: ${safeStr(c.display_name, 100)}\nTarget: ${safeStr(c.molecular_target)}\nMechanism: ${safeStr(c.mechanism)}\nSide Effects: ${safeStr(c.side_effects)}`
    ).join('\n---\n');

    const systemPrompt = `You are an expert peptide research pharmacologist. 
Analyze the synergy and safety of the following custom compound stack:

${compoundContext}

Evaluate whether these compounds act on the same receptors (redundancy), opposing receptors (counterproductive), or complementary pathways (synergy).

Respond with a JSON object with EXACTLY these fields:
{
  "synergyScore": <integer 0-100, where 100 is perfect synergy and 0 is dangerous/counterproductive>,
  "verdict": <short 1-3 word verdict, e.g. "Highly Synergistic", "Counterproductive", "Redundant", "Dangerous">,
  "analysis": <2-3 sentence pharmacological analysis explaining why these compounds do or do not work well together>,
  "warnings": <array of strings listing specific contraindications or safety warnings, empty array if none>
}`;

    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.GROK_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'grok-3-mini',
        messages: [{ role: 'user', content: systemPrompt }],
        temperature: 0.2,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      console.error('Grok API error:', errData);
      return NextResponse.json({ error: 'Failed to generate stack analysis' }, { status: 500 });
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content ?? '';
    
    try {
      const cleanText = text.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();
      const result = JSON.parse(cleanText);
      return NextResponse.json(result);
    } catch (e) {
      console.error('Failed to parse JSON', e, text);
      return NextResponse.json({ error: 'Failed to generate stack analysis' }, { status: 500 });
    }
  } catch (error) {
    console.error('Error in ai-stack-analysis:', error);
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}
