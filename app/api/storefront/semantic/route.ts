import { NextResponse, type NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import { assertSameOrigin } from '@/lib/csrf';
import { GoogleGenAI } from '@google/genai';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const ip = getClientIp(req);
  const limited = await rateLimit({
    key: 'storefront_semantic',
    limit: 120, // slightly higher limit since it fires on debounce
    windowSeconds: 60,
    identifier: ip,
  });
  if (!limited.allowed) {
    return NextResponse.json({ matches: {} }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  let q = body.q;
  if (typeof q !== 'string' || q.trim().length < 3) {
    return NextResponse.json({ matches: {} }, { status: 200 });
  }
  q = q.trim().slice(0, 100);

  let matches: Record<string, { score: number, reason: string }> = {};

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const response = await ai.models.embedContent({
      model: 'gemini-embedding-001',
      contents: [q],
    });
    const queryEmbedding = response.embeddings?.[0]?.values;
    
    if (queryEmbedding) {
      const supabase = await createServiceClient();
      const { data: vectorMatches, error: vecErr } = await supabase.rpc('match_products_vector', {
        query_embedding: queryEmbedding,
        match_threshold: 0.1, // Adjust as needed
        match_limit: 12
      });

      if (!vecErr && vectorMatches && vectorMatches.length > 0) {
        vectorMatches.forEach((m: any) => {
          matches[m.product_id] = {
            score: m.similarity,
            reason: `AI Match: Semantically Related`
          };
        });
      }
    }
  } catch (e) {
    console.error('Semantic vector generation failed:', e);
  }

  return NextResponse.json({ matches }, { status: 200 });
}
