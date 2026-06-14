import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { GoogleGenAI } from '@google/genai';
import { assertSameOrigin } from '@/lib/csrf';
import { rateLimit, getClientIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const ip = getClientIp(req);
  const rl = await rateLimit({ key: 'ai_summary', limit: 10, windowSeconds: 60, identifier: ip });
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  try {
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: 'GEMINI_API_KEY is not configured' }, { status: 501 });
    }

    const { slug } = await req.json();
    if (!slug) {
      return NextResponse.json({ error: 'Compound slug is required' }, { status: 400 });
    }

    const supabase = await createServiceClient();
    const { data: compound, error } = await supabase
      .from('compounds')
      .select('display_name, mechanism, side_effects, warnings, molecular_target, plain_summary')
      .eq('slug', slug)
      .single();

    if (error || !compound) {
      return NextResponse.json({ error: 'Compound not found' }, { status: 404 });
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    
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

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    const summary = response.text || 'Failed to generate summary.';

    return NextResponse.json({ summary });
  } catch (error) {
    console.error('Error generating AI summary:', error);
    return NextResponse.json({ error: 'Failed to generate AI summary' }, { status: 500 });
  }
}
