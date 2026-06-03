/**
 * GET /api/cron/search-refresh
 *
 * Authenticated via CRON_SECRET (constant-time compare). Refreshes the
 * compound_search materialized view concurrently so the search index
 * stays fresh after a catalog edit, alias change, or evidence-tier
 * update.
 */

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { assertCronAuth } from '@/lib/cron';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const unauth = assertCronAuth(req);
  if (unauth) return unauth;

  try {
    const supabase = await createServiceClient();
    const { error } = await supabase.rpc('refresh_compound_search');
    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 },
      );
    }
    return NextResponse.json({
      ok: true,
      refreshedAt: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
