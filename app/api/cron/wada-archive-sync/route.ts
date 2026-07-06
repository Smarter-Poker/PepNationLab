/**
 * GET /api/cron/wada-archive-sync
 * Monthly WADA archive sync. Walks the curated per-year PDF list and
 * adds a reference row when a new year drops or an URL changes. Never
 * mutates compounds.wada_status (that is admin-curated).
 */
import { NextResponse } from 'next/server';
import { assertCronAuth } from '@/lib/cron';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const unauth = assertCronAuth(req);
  if (unauth) return unauth;

  return NextResponse.json({ ok: true, skipped: true, reason: 'wada_sync_disabled' });
}

