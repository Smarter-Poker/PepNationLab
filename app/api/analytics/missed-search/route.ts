import { NextResponse, type NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import { assertSameOrigin } from '@/lib/csrf';

export const dynamic = 'force-dynamic';

/**
 * Missed-search logging (zero-result storefront queries).
 *
 * Anonymous-friendly by design: the only caller is the PUBLIC storefront grid,
 * where most visitors are guests. The old auth requirement silently 401-dropped
 * every guest miss, which is exactly the traffic this table exists to capture.
 * No user id or IP is stored -- just the query text and source.
 */
export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const limited = await rateLimit({
    key: 'missed_search',
    identifier: getClientIp(req),
    limit: 20,
    windowSeconds: 60,
  });
  if (!limited.allowed) return new Response(null, { status: 204 });

  try {
    const { query } = await req.json();

    if (!query || typeof query !== 'string' || query.trim().length === 0 || query.length > 500) {
      return NextResponse.json({ success: false, error: 'Invalid query' }, { status: 400 });
    }

    const supabase = await createServiceClient();

    const { error } = await supabase.from('missed_searches').insert({
      query: query.trim().slice(0, 500),
      source: 'storefront'
    });

    if (error) {
      // Best-effort analytics: never surface a storage failure to the caller.
      console.error('[Missed Searches Analytics] Failed to insert', error);
    }

    return new Response(null, { status: 204 });
  } catch {
    return new Response(null, { status: 204 });
  }
}
