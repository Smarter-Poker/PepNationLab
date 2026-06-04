import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { GoogleGenAI } from '@google/genai';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { compounds, goal } = await req.json();

    if (!compounds || !Array.isArray(compounds) || compounds.length === 0) {
      return NextResponse.json({ error: 'At least one compound is required' }, { status: 400 });
    }
    if (!goal) {
      return NextResponse.json({ error: 'A research goal is required' }, { status: 400 });
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: 'GEMINI_API_KEY is missing' }, { status: 500 });
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    
    const prompt = `
You are an advanced expert in peptide and research compound protocols. 
The researcher wants a 12-week protocol for the following goal: "${goal}"
Using the following compounds: ${compounds.join(', ')}

Please generate a detailed 12-week schedule formatted as a clean Markdown document. 
Include:
- A brief synergy overview of why these compounds work together for this goal.
- Week-by-week dosing frequency and volume guidelines (use safe, standard investigational doses).
- Important warnings or contraindications.
- A "Check-in" milestones section (e.g., what to measure at Week 4, 8, 12).

Keep it highly professional, structured, and easy to read. Do not use generic AI disclaimers, act as a strict scientific assistant.
`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    const protocolMarkdown = response.text || 'Error generating protocol.';

    // Automatically save this as a note
    const { data: noteData, error: noteError } = await supabase
      .from('researcher_notes')
      .insert({
        user_id: session.user.id,
        title: `AI Protocol: ${goal}`,
        note_text: protocolMarkdown
      })
      .select()
      .single();

    if (noteError) throw noteError;

    return NextResponse.json({ note: noteData, protocol: protocolMarkdown });
  } catch (error) {
    console.error('Error generating AI protocol:', error);
    return NextResponse.json({ error: 'Failed to generate protocol' }, { status: 500 });
  }
}
