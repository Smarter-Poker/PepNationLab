import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';
import { requireAdmin } from '@/lib/admin-auth';
import { DeleteReportedMessageSchema } from '@/lib/messenger/schemas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const body = await req.json().catch(() => ({}));
  const parsed = DeleteReportedMessageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid Body', details: parsed.error.flatten() }, { status: 400 });
  }

  const { messageId, reportId } = parsed.data;
  const svc = await createServiceClient();

  const { data: existing } = await svc
    .from('messenger_messages')
    .select('id')
    .eq('id', messageId)
    .maybeSingle();
  if (!existing) {
    return NextResponse.json({ error: 'Message Not Found' }, { status: 404 });
  }

  const { error: updErr } = await svc
    .from('messenger_messages')
    .update({
      is_deleted: true,
      delete_scope: 'for_everyone',
      text: null,
      media_url: null,
      media_metadata: {},
      updated_at: new Date().toISOString(),
    })
    .eq('id', messageId);

  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 500 });
  }

  // Auto-resolve associated report if provided.
  // Audit7 fix: validate the report actually belongs to this message before
  // resolving it. A misplaced reportId (admin client bug, manual API call,
  // copy/paste from another row) would otherwise silently mark an unrelated
  // report as "Message Deleted For Everyone" -- a data-integrity issue in the
  // moderation audit trail. Add the message_id predicate so the UPDATE is a
  // no-op if the (reportId, messageId) pair does not match.
  if (reportId) {
    await svc
      .from('messenger_reports')
      .update({
        status: 'resolved',
        resolved_by: gate.userId,
        resolved_at: new Date().toISOString(),
        resolution_note: 'Message Deleted For Everyone',
      })
      .eq('id', reportId)
      .eq('message_id', messageId);
  }

  // Audit6 fix: when an admin deletes a message that previously triggered an
  // @admin mention, auto-resolve the associated messenger_admin_messages row
  // so it does not linger in the unread admin inbox pointing at a tombstoned
  // message. Best-effort and idempotent (only updates rows that are not
  // already resolved).
  await svc
    .from('messenger_admin_messages')
    .update({
      status: 'resolved',
      resolved_by: gate.userId,
      resolved_at: new Date().toISOString(),
      resolution_note: 'Resolved Automatically When Message Deleted For Everyone',
    })
    .eq('message_id', messageId)
    .neq('status', 'resolved');

  await svc.from('admin_audit_log').insert({
    actor_id: gate.userId,
    action: 'messenger_message_deleted_for_everyone',
    entity_type: 'messenger_message',
    entity_id: messageId,
    changes: { reportId: reportId ?? null },
  });

  return NextResponse.json({ ok: true });
}
