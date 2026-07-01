/**
 * POST /api/research/click
 *
 * Best-effort CTR analytics ping. Updates the most-recent matching
 * search_queries row (within the last 5 minutes for the same query) to
 * record which result the user clicked + its 0-indexed position. If no
 * matching row exists, inserts a standalone click record so we still
 * capture the signal.
 *
 * Returns 204 unconditionally - never blocks or surfaces an error to
 * the client. Public route; rate-limited per IP.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { rateLimit, getClientIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

const FIVE_MIN_MS = 5 * 60 * 1000;

export async function POST(req: NextRequest) {
  // Persistent per-IP rate limit: 30 req / 10s.
  // Uses the shared Redis-backed rateLimit() so it works correctly on Vercel
  // serverless (in-process Maps reset on cold start and provide zero protection).
  const ip = getClientIp(req);
  const rl = await rateLimit({ key: 'research_click', limit: 30, windowSeconds: 10, identifier: ip });
  if (!rl.allowed) {
    return new NextResponse(null, { status: 204 });
  }

  let body: {
    query?: unknown;
    clickedSlug?: unknown;
    clickedPosition?: unknown;
    intent?: unknown;
  } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return new NextResponse(null, { status: 204 });
  }

  const query = typeof body.query === 'string' ? body.query.slice(0, 256) : '';
  const clickedSlug =
    typeof body.clickedSlug === 'string' ? body.clickedSlug.slice(0, 128) : '';
  const clickedPositionRaw =
    typeof body.clickedPosition === 'number' ? body.clickedPosition : -1;
  const intent =
    typeof body.intent === 'string' ? body.intent.slice(0, 64) : null;

  if (!query || !clickedSlug || clickedPositionRaw < 0) {
    return new NextResponse(null, { status: 204 });
  }
  const clickedPosition = Math.floor(clickedPositionRaw);
  const queryNormalized = normalize(query);

  try {
    const supabase = await createServiceClient();
    const sinceIso = new Date(Date.now() - FIVE_MIN_MS).toISOString();

    // Find the most-recent matching search_queries row.
    const { data: existing } = await supabase
      .from('search_queries')
      .select('id')
      .eq('query_normalized', queryNormalized)
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing && (existing as { id?: string }).id) {
      await supabase
        .from('search_queries')
        .update({
          clicked_slug: clickedSlug,
          clicked_position: clickedPosition,
        })
        .eq('id', (existing as { id: string }).id);
    } else {
      // No prior row in the 5-minute window - capture a fresh one.
      await supabase.from('search_queries').insert({
        query_text: query,
        query_normalized: queryNormalized,
        result_count: 0,
        intent,
        top_result_slug: null,
        clicked_slug: clickedSlug,
        clicked_position: clickedPosition,
        latency_ms: null,
      });
    }
  } catch {
    // Best-effort; never surface.
  }

  return new NextResponse(null, { status: 204 });
}
