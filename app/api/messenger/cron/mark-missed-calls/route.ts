import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getCronAuth } from '@/lib/messenger/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Audit9: a ringing call with no accept/decline/hangup wedges the next call
// in the same conversation (the start guard refuses to create a second
// active row). Sweep rows older than 60 seconds in `ringing` status to
// `missed`.
export async function GET(req: NextRequest) {
  const auth = getCronAuth(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const svc = await createServiceClient();
  const nowIso = new Date().toISOString();
  const cutoffIso = new Date(Date.now() - 60_000).toISOString();

  const { data, error } = await svc
    .from('messenger_calls')
    .update({ status: 'missed', ended_at: nowIso })
    .eq('status', 'ringing')
    .lt('started_at', cutoffIso)
    .select('id');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ marked: (data ?? []).length });
}
