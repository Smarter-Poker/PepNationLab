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
    .select('id, message_id')
    .eq('status', 'pending')
    .lte('remind_at', nowIso)
    .order('remind_at', { ascending: true })
    .limit(100);
  if (qErr) return NextResponse.json({ error: qErr.message }, { status: 500 });

  const candidates = (due ?? []) as Array<{ id: string; message_id: string | null }>;
  if (candidates.length === 0) return NextResponse.json({ fired: 0, scanned: 0, cancelled: 0 });

  // Audit5 fix: if a reminder is bound to a message that was soft-deleted
  // after the reminder was set, cancel the reminder rather than fire it. The
  // POST /reminder route already gates on is_deleted at create time; this
  // covers the race where the message was deleted between create and fire.
  const messageIds = Array.from(
    new Set(
      candidates
        .map((r) => r.message_id)
        .filter((v): v is string => Boolean(v)),
    ),
  );
  const deletedMessageIds = new Set<string>();
  if (messageIds.length > 0) {
    const { data: deletedRows } = await svc
      .from('messenger_messages')
      .select('id')
      .in('id', messageIds)
      .eq('is_deleted', true);
    (deletedRows ?? []).forEach((m) => deletedMessageIds.add(m.id as string));
  }

  const toCancel = candidates
    .filter((r) => r.message_id && deletedMessageIds.has(r.message_id))
    .map((r) => r.id);
  const toFire = candidates
    .filter((r) => !r.message_id || !deletedMessageIds.has(r.message_id))
    .map((r) => r.id);

  let cancelledCount = 0;
  if (toCancel.length > 0) {
    const { data: cancelled, error: cErr } = await svc
      .from('messenger_reminders')
      .update({ status: 'cancelled' })
      .in('id', toCancel)
      .eq('status', 'pending')
      .select('id');
    if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 });
    cancelledCount = (cancelled ?? []).length;
  }

  let firedCount = 0;
  if (toFire.length > 0) {
    const { data: fired, error: upErr } = await svc
      .from('messenger_reminders')
      .update({ status: 'fired', fired_at: nowIso })
      .in('id', toFire)
      .eq('status', 'pending')
      .select('id');
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });
    firedCount = (fired ?? []).length;
  }

  return NextResponse.json({
    fired: firedCount,
    cancelled: cancelledCount,
    scanned: candidates.length,
  });
}
