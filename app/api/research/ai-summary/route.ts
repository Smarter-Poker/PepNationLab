import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';
import { rateLimit, getClientIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

async function grokGenerate(prompt: string): Promise<string> {
  const response = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.GROK_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'grok-3-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.5,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(`Grok API error: ${JSON.stringify(err)}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content ?? '';
}

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  // Auth gate — must be an authenticated researcher
  const supabase = await createServiceClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Rate-limit keyed on user.id (not IP) to prevent shared-NAT bypass
  const rl = await rateLimit({ key: 'ai_summary', limit: 10, windowSeconds: 60, identifier: user.id });
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  try {
    if (!process.env.GROK_API_KEY) {
      return NextResponse.json({ error: 'GROK_API_KEY is not configured' }, { status: 501 });
    }

    const { slug } = await req.json();
    if (!slug || typeof slug !== 'string' || slug.length > 200) {
      return NextResponse.json({ error: 'Valid compound slug is required (max 200 chars)' }, { status: 400 });
    }

    const supabase = await createServiceClient();
    const { data: compound, error } = await supabase
      .from('compounds')
      .select('display_name, mechanism, side_effects, warnings, molecular_target, plain_summary')
      .eq('slug', slug)
      .maybeSingle();

    if (error || !compound) {
      return NextResponse.json({ error: 'Compound not found' }, { status: 404 });
    }

    const prompt = `
You are an expert scientific communicator tasked with explaining a complex research peptide/compound to a beginner researcher in simple "Explain Like I'm 5" (ELI5) terms.

Compound Name: ${compound.display_name}
Mechanism of Action: ${compound.mechanism || 'Unknown'}
Molecular Target: ${compound.molecular_target || 'Unknown'}
Side Effects/Warnings: ${compound.side_effects || ''} ${compound.warnings || ''}

Please generate exactly 3 bullet points that summarize:
1. What the compound actually does in the body (in plain English, using analogies if helpful).
2. The primary real-world benefit researchers look for.
3. The most important safety warning or side effect to watch out for.

Keep the bullet points concise but highly educational. Format as a clean markdown list. Do not use generic AI disclaimers.
`;

    const summary = await grokGenerate(prompt) || 'Failed to generate summary.';
    return NextResponse.json({ summary });
  } catch (error) {
    console.error('Error generating AI summary:', error);
    return NextResponse.json({ error: 'Failed to generate AI summary' }, { status: 500 });
  }
}
