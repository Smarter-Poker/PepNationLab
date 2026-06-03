import { NextResponse, type NextRequest } from 'next/server';
import { GoogleGenAI, Type } from '@google/genai';
import { RESEARCH_AREAS } from '@/lib/compounds';

export const dynamic = 'force-dynamic';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    goal: {
      type: Type.STRING,
      description: `The best matching research area. Must be one of the following exact keys: ${Object.keys(RESEARCH_AREAS).join(', ')}, or 'any'. If they want a general overview or don't specify a goal, use 'any'. If none match perfectly, choose the closest or default to 'any'.`,
    },
    evidenceComfort: {
      type: Type.STRING,
      description: "The user's comfort with unproven compounds. Must be one of: 'strict_human_only', 'investigational_ok', 'preclinical_ok', 'any'. If they seem highly risk-averse, use strict_human_only. If they mention research chemicals, use 'any'. Default to 'preclinical_ok'.",
    },
    wadaConstraint: {
      type: Type.STRING,
      description: "Must be either 'wada_permitted_only' or 'no_constraint'. Use 'wada_permitted_only' if they mention athletics, sports, tested, or WADA.",
    },
    riskTolerance: {
      type: Type.STRING,
      description: "Must be one of: 'low_only', 'moderate_ok', 'any'. If they want super safe, use 'low_only'. Default to 'any'.",
    },
    excludeInjectables: {
      type: Type.BOOLEAN,
      description: "True if they mention they hate needles, want oral/topical, or do not want to inject.",
    },
    requireLongHalfLife: {
      type: Type.BOOLEAN,
      description: "True if they want low frequency of administration, e.g., 'once a week' or 'long acting'.",
    },
    preference: {
      type: Type.STRING,
      description: "Must be 'single', 'stack', or 'either'. If they specifically want a pre-blended stack or synergy, use 'stack'. If they want a single compound, use 'single'. Default to 'either'.",
    }
  },
  required: ['goal', 'evidenceComfort', 'wadaConstraint', 'riskTolerance', 'excludeInjectables', 'requireLongHalfLife', 'preference'],
};

export async function POST(req: NextRequest) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: 'GEMINI_API_KEY is not configured.' }, { status: 501 });
    }

    const { prompt } = await req.json();
    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json({ error: 'Invalid prompt' }, { status: 400 });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        { role: 'user', parts: [{ text: `Translate the following research request into strict search parameters for our peptide database: "${prompt}"` }] }
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: RESPONSE_SCHEMA,
        temperature: 0.1,
      }
    });

    const text = response.text;
    if (!text) throw new Error('Empty response from AI');

    try {
      const cleanText = text.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();
      const result = JSON.parse(cleanText);
      return NextResponse.json({ result });
    } catch (parseError: any) {
      console.error('JSON Parse Error:', parseError);
      return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 });
    }
  } catch (error: any) {
    console.error('AI Match Error:', error);
    return NextResponse.json({ error: error.message || 'AI request failed' }, { status: 500 });
  }
}
