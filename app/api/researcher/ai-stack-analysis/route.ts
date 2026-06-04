import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { GoogleGenAI, Type } from '@google/genai';

export const dynamic = 'force-dynamic';

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    synergyScore: {
      type: Type.INTEGER,
      description: "A score from 0 to 100 representing how well these compounds synergize for common research goals. 100 is perfect synergy, 0 is dangerous/counterproductive.",
    },
    verdict: {
      type: Type.STRING,
      description: "A short 1-3 word verdict. e.g. 'Highly Synergistic', 'Counterproductive', 'Redundant', 'Dangerous'.",
    },
    analysis: {
      type: Type.STRING,
      description: "A 2-3 sentence pharmacological analysis explaining why these compounds do or do not work well together.",
    },
    warnings: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "List of specific contraindications or safety warnings. Empty array if none.",
    }
  },
  required: ['synergyScore', 'verdict', 'analysis', 'warnings'],
};

export async function POST(req: NextRequest) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: 'GEMINI_API_KEY is not configured' }, { status: 501 });
    }

    const { slugs } = await req.json();
    if (!slugs || !Array.isArray(slugs) || slugs.length < 2) {
      return NextResponse.json({ error: 'At least 2 compounds are required for stack analysis' }, { status: 400 });
    }

    const supabase = await createServiceClient();
    
    const { data: compounds, error } = await supabase
      .from('compounds')
      .select('slug, display_name, mechanism, molecular_target, warnings, side_effects')
      .in('slug', slugs);

    if (error || !compounds || compounds.length !== slugs.length) {
      return NextResponse.json({ error: 'Failed to load all compounds' }, { status: 404 });
    }

    const compoundContext = compounds.map(c => 
      `Name: ${c.display_name}\nTarget: ${c.molecular_target}\nMechanism: ${c.mechanism}\nSide Effects: ${c.side_effects}`
    ).join('\n---\n');

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    
    const systemPrompt = `
You are an expert peptide research pharmacologist. 
Please analyze the synergy and safety of the following custom compound stack:

${compoundContext}

Evaluate whether these compounds act on the same receptors (redundancy), opposing receptors (counterproductive), or complementary pathways (synergy).
Return your analysis strictly in the requested JSON schema.
`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: systemPrompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: RESPONSE_SCHEMA,
        temperature: 0.2,
      }
    });

    const text = response.text || '';
    
    try {
      const cleanText = text.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();
      const result = JSON.parse(cleanText);
      return NextResponse.json(result);
    } catch (e) {
      console.error('Failed to parse JSON', e);
      return NextResponse.json({ error: 'Failed to generate stack analysis' }, { status: 500 });
    }
  } catch (error) {
    console.error('Error in ai-stack-analysis:', error);
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}
