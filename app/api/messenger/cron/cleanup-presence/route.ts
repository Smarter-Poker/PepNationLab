
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getCronAuth } from '@/lib/messenger/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Audit9: `messenger_presence` is currently only used in some surfaces; this
// cron drops rows older than 5 minutes so the table cannot grow unbounded.
// If the table is not present this is a no-op (caller still returns 200).
export async function GET(req: NextRequest) {
  const auth = getCronAuth(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const svc = createAdminClient();
  const cutoffIso = new Date(Date.now() - 5 * 60_000).toISOString();

  try {
    const { data, error } = await svc
      .from('messenger_presence') // @ts-ignore
      .delete()
      .lt('last_seen_at', cutoffIso)
      .select('id');
    if (error) {
      // Table missing or column missing -- noop without raising.
      return NextResponse.json({ deleted: 0, note: 'cleanup_error' });
    }
    return NextResponse.json({ deleted: (data ?? []).length });
  } catch (e) {
    return NextResponse.json({ deleted: 0, note: 'cleanup_error' });
  }
}
