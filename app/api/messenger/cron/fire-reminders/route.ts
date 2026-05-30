import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getCronAuth } from '@/lib/messenger/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = getCronAuth(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const svc = await createServiceClient();
  const nowIso = new Date().toISOString();

  const { data: due, error: qErr } = await svc
    .from('messenger_reminders')
    .select('id')
    .eq('status', 'pending')
    .lte('remind_at', nowIso)
    .order('remind_at', { ascending: true })
    .limit(100);
  if (qErr) return NextResponse.json({ error: qErr.message }, { status: 500 });

  const ids = (due ?? []).map((r) => r.id as string);
  if (ids.length === 0) return NextResponse.json({ fired: 0, scanned: 0 });

  const { data: fired, error: upErr } = await svc
    .from('messenger_reminders')
    .update({ status: 'fired', fired_at: nowIso })
    .in('id', ids)
    .eq('status', 'pending')
    .select('id');
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  return NextResponse.json({ fired: (fired ?? []).length, scanned: ids.length });
}
