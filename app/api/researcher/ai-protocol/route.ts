import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getEffectiveUser } from '@/lib/impersonation';
import { assertSameOrigin } from '@/lib/csrf';
import { rateLimit, getClientIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

async function grokGenerate(prompt: string, temperature = 0.7): Promise<string> {
  const response = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.GROK_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'grok-3-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature,
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

  const supabase = await createClient();
  const { data: { user } } = await getEffectiveUser(supabase);

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Rate limit per user to prevent Grok API cost abuse
  const ip = getClientIp(req);
  const rlMinute = await rateLimit({ key: 'ai_protocol_min', limit: 5, windowSeconds: 60, identifier: user.id || ip });
  const rlDaily = await rateLimit({ key: 'ai_protocol_daily', limit: 20, windowSeconds: 86400, identifier: user.id || ip });
  if (!rlMinute.allowed || !rlDaily.allowed) {
    return NextResponse.json({ error: 'Too Many Requests' }, { status: 429 });
  }

  try {
    const body = await req.json();
    const { compounds, goal, experienceLevel, subjectMetrics } = body;

    if (!Array.isArray(compounds) || compounds.length === 0 || compounds.length > 10) {
      return NextResponse.json({ error: 'Valid compounds array required (max 10)' }, { status: 400 });
    }
    const safeCompounds = compounds.filter(c => typeof c === 'string').map(c => String(c).slice(0, 100));

    if (typeof goal !== 'string' || !goal.trim() || goal.length > 500) {
      return NextResponse.json({ error: 'Goal must be a string under 500 characters' }, { status: 400 });
    }
    const safeGoal = goal.trim();

    const safeExperience = typeof experienceLevel === 'string' ? experienceLevel.slice(0, 100) : 'Not specified';
    const safeMetrics = typeof subjectMetrics === 'string' ? subjectMetrics.slice(0, 500) : 'Not specified';

    if (!process.env.GROK_API_KEY) {
      return NextResponse.json({ error: 'AI service not configured' }, { status: 503 });
    }

    const prompt = `
You are an advanced expert in peptide and research compound protocols. 
The researcher wants a protocol for the following goal: "${safeGoal}"
Using the following compounds: ${safeCompounds.join(', ')}

Subject Details (for dosage calibration and safety considerations):
- Experience Level: ${safeExperience}
- Subject Metrics: ${safeMetrics}

Please generate a detailed protocol formatted as a clean Markdown document. 
Structure the response STRICTLY into two phases:

# Phase 1: 12-Week Active Protocol
- A brief synergy overview of why these compounds work together for this goal, factoring in the subject's experience.
- Week-by-week dosing frequency and volume guidelines (use safe, standard investigational doses based on experience level).
- Important warnings or contraindications.
- A "Check-in" milestones section (e.g., what to measure at Week 4, 8, 12).

# Phase 2: Washout & Receptor Reset
- Calculate the necessary washout period based the terminal half-lives of the compounds provided.
- Provide a clear timeline (e.g., 4 weeks) of complete abstinence to clear the system and prevent receptor downregulation.
- Suggest any non-suppressive support protocols (like diet/training shifts) during this period.

Keep it highly professional, structured, and easy to read. Do not use generic AI disclaimers, act as a strict scientific assistant.
`;

    const protocolMarkdown = await grokGenerate(prompt) || 'Error generating protocol.';

    // Automatically save this as a note
    const { data: noteData, error: noteError } = await supabase
      .from('researcher_notes')
      .insert({
        user_id: user.id,
        title: `AI Protocol: ${safeGoal}`.slice(0, 255),
        note_text: protocolMarkdown
      })
      .select()
      .maybeSingle();

    if (noteError) throw noteError;

    return NextResponse.json({ note: noteData, protocol: protocolMarkdown });
  } catch (error) {
    console.error('Error generating AI protocol:', error);
    return NextResponse.json({ error: 'Failed to generate protocol' }, { status: 500 });
  }
}
