import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { GoogleGenAI } from '@google/genai';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: 'GEMINI_API_KEY is not configured' }, { status: 501 });
    }

    const { prompt } = await req.json();
    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    const supabase = await createServiceClient();
    
    // Fetch a simplified catalog of available products and their corresponding compounds
    // We fetch from compounds to get the research areas, benefits, and mechanisms.
    const { data: compounds, error } = await supabase
      .from('compounds')
      .select('slug, display_name, category, plain_summary, studied_for, mechanism');

    if (error || !compounds) {
      return NextResponse.json({ error: 'Failed to load catalog' }, { status: 500 });
    }

    const catalogContext = compounds.map(c => 
      `Name: ${c.display_name} (Slug: ${c.slug})\nCategory: ${c.category}\nStudied For: ${(c.studied_for || []).join(', ')}\nSummary: ${c.plain_summary}`
    ).join('\n---\n');

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    
    const systemPrompt = `
You are the AI Shopping Assistant for PepNationLab, a premium research peptide distributor.
Your goal is to help researchers find the exact compound they need based on their prompt.
Here is our current catalog of compounds:
---
${catalogContext}
---

Given the user's prompt, recommend the top 1 or 2 best compounds from our catalog. 
Format your response in a friendly, conversational tone. 
Explain WHY the compound(s) fit their exact criteria (e.g., if they asked for no injectables, highlight an oral/topical option).

At the very end of your response, output a special JSON block containing the slugs of the recommended compounds so the UI can render "Add to Cart" buttons. 
Use this exact format for the JSON block (and do not put any text after it):
\`\`\`json
{
  "recommendedSlugs": ["bpc-157", "tb-500"]
}
\`\`\`

User Prompt: "${prompt}"
`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: systemPrompt,
    });

    const text = response.text || '';
    
    // Parse out the JSON block
    let answer = text;
    let recommendedSlugs: string[] = [];
    
    const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/);
    if (jsonMatch && jsonMatch[1]) {
      try {
        const parsed = JSON.parse(jsonMatch[1]);
        recommendedSlugs = parsed.recommendedSlugs || [];
        answer = text.replace(jsonMatch[0], '').trim();
      } catch (e) {
        console.error('Failed to parse JSON block from AI', e);
      }
    }

    return NextResponse.json({ answer, recommendedSlugs });
  } catch (error) {
    console.error('Error in AiShoppingAssistant:', error);
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}
