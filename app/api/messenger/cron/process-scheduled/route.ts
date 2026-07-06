import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getCronAuth } from '@/lib/messenger/server';
import { hasAdminMention, recordAdminMention } from '@/lib/messenger/admin-mentions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ScheduledRow {
  id: string;
  conversation_id: string;
  sender_id: string;
  text: string | null;
  message_type: string;
  media_url: string | null;
  media_metadata: Record<string, unknown> | null;
  reply_to_id: string | null;
  scheduled_at: string;
  status: string;
}

export async function GET(req: NextRequest) {
  const auth = getCronAuth(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const svc = createAdminClient();
  const nowIso = new Date().toISOString();

  const { data: rows, error: qErr } = await svc
    .from('messenger_scheduled')
    .select('id, conversation_id, sender_id, text, message_type, media_url, media_metadata, reply_to_id, scheduled_at, status')
    .eq('status', 'pending')
    .lte('scheduled_at', nowIso)
    .order('scheduled_at', { ascending: true })
    .limit(50);
  if (qErr) return NextResponse.json({ error: 'An Unexpected Error Occurred' }, { status: 500 });

  const list = (rows ?? []) as ScheduledRow[];
  let processed = 0;
  let cancelled = 0;

  for (const row of list) {
    // Re-verify the sender is still a participant. If not, mark cancelled
    // rather than insert into a conversation they no longer belong to.
    const { data: part } = await svc
      .from('messenger_participants')
      .select('id')
      .eq('conversation_id', row.conversation_id)
      .eq('user_id', row.sender_id)
      .maybeSingle();

    if (!part) {
      const { error: cErr } = await svc
        .from('messenger_scheduled')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('id', row.id)
        .eq('status', 'pending');
      if (!cErr) cancelled += 1;
      continue;
    }

    // Validate reply target still belongs to the same conversation AND has
    // not been soft-deleted in the meantime. Audit5 fix: drop reply_to_id
    // if the parent message is deleted rather than send a broken reply.
    let replyToId: string | null = row.reply_to_id;
    if (replyToId) {
      const { data: parent } = await svc
        .from('messenger_messages')
        .select('conversation_id, is_deleted')
        .eq('id', replyToId)
        .maybeSingle();
      if (
        !parent ||
        parent.conversation_id !== row.conversation_id ||
        parent.is_deleted === true
      ) {
        replyToId = null; // Drop dangling/deleted reply rather than fail the send.
      }
    }

    // Optimistic-claim: only insert and mark sent if the row is still pending.
    // This is the simplest race-safe pattern without a distributed lock - the
    // update sets status='sent' atomically and the .eq('status','pending')
    // guard means a concurrent invocation will get rowCount=0 and skip.
    const { data: claimed, error: claimErr } = await svc
      .from('messenger_scheduled')
      .update({ status: 'sent', updated_at: new Date().toISOString() })
      .eq('id', row.id)
      .eq('status', 'pending')
      .select('id')
      .maybeSingle();
    if (claimErr || !claimed) continue;

    const { data: insertedMsg, error: insErr } = await svc
      .from('messenger_messages')
      .insert({
        conversation_id: row.conversation_id,
        sender_id: row.sender_id,
        text: row.text,
        message_type: row.message_type,
        media_url: row.media_url,
        media_metadata: row.media_metadata ?? {},
        reply_to_id: replyToId,
      })
      .select('id')
      .maybeSingle();
    if (insErr || !insertedMsg) {
      // Roll the scheduled row back to pending so the next tick can retry.
      await svc
        .from('messenger_scheduled')
        .update({ status: 'pending', updated_at: new Date().toISOString() })
        .eq('id', row.id);
      continue;
    }

    // Audit6 fix: scheduled messages were skipping @admin detection because
    // the cron bypasses /api/messenger/send-message. Run the shared detector
    // here so admins still see the moderation entry when a scheduled message
    // fires with @admin in the body.
    if (row.text && hasAdminMention(row.text)) {
      await recordAdminMention(svc, {
        messageId: (insertedMsg as { id: string }).id,
        conversationId: row.conversation_id,
        senderId: row.sender_id,
        text: row.text,
      });
    }

    processed += 1;
  }

  return NextResponse.json({ processed, cancelled, scanned: list.length });
}
