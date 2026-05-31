/**
 * audit15 fix-20 (B3): web push for incoming calls.
 *
 * `enqueueCallRingPush` writes one push_outbox row per target. The
 * existing /api/cron/push-dispatch (every 5min) drains it via lib/web-push.
 * For ring-latency we also expose `sendCallRingPushNow` which calls
 * sendWebPush directly, bypassing the cron tick.
 *
 * Both paths share the same payload shape so a duplicate (cron + inline)
 * delivery is harmless — the browser collapses by tag.
 */

import { createServiceClient } from '@/lib/supabase/server';
import { sendWebPush, isWebPushConfigured } from '@/lib/web-push';

export interface CallRingPushInput {
  callId: string;
  callType: 'audio' | 'video';
  /** UUIDs of users to ring. */
  targetUserIds: string[];
  /** Display name to show in the push body. */
  callerName: string;
  /** conversation id for the URL deep-link. */
  conversationId: string;
}

interface OutboxInsertRow {
  recipient_user_id: string;
  title: string;
  body: string;
  url: string;
  tag: string;
  event: string;
}

function payloadFor(input: CallRingPushInput): {
  title: string;
  body: string;
  url: string;
  tag: string;
} {
  const typeLabel = input.callType === 'video' ? 'Video Call' : 'Voice Call';
  return {
    title: `Incoming ${typeLabel}`,
    body: `${input.callerName} Is Calling`,
    url: `/messenger?call=${input.callId}`,
    tag: `messenger-call-${input.callId}`,
  };
}

/**
 * Insert one push_outbox row per target. Idempotent against the same
 * recipient + tag combination because the cron skips already-sent rows
 * and the browser dedupes by tag.
 */
export async function enqueueCallRingPush(input: CallRingPushInput): Promise<number> {
  if (input.targetUserIds.length === 0) return 0;
  const { title, body, url, tag } = payloadFor(input);

  const rows: OutboxInsertRow[] = input.targetUserIds.map((uid) => ({
    recipient_user_id: uid,
    title,
    body,
    url,
    tag,
    event: 'messenger.call.incoming',
  }));

  try {
    const svc = await createServiceClient();
    const { error } = await svc.from('push_outbox').insert(rows);
    if (error) {
      console.warn('[messenger.call] push_outbox insert failed', {
        call_id: input.callId,
        err: error.message,
      });
      return 0;
    }
    return rows.length;
  } catch (err) {
    console.warn('[messenger.call] push_outbox insert threw', {
      call_id: input.callId,
      err: err instanceof Error ? err.message : String(err),
    });
    return 0;
  }
}

/**
 * Best-effort low-latency dispatch path. Reads active subscriptions for
 * each target and sends directly via web-push. Does NOT depend on the
 * outbox cron — caller still inserts an outbox row for durability if
 * the user's device is offline now.
 *
 * Failures are swallowed; the outbox cron retries.
 */
export async function sendCallRingPushNow(input: CallRingPushInput): Promise<number> {
  if (input.targetUserIds.length === 0) return 0;
  if (!isWebPushConfigured()) return 0;

  const { title, body, url, tag } = payloadFor(input);
  let sent = 0;

  try {
    const svc = await createServiceClient();
    const { data: subs } = await svc
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth, user_id')
      .in('user_id', input.targetUserIds)
      .eq('is_active', true);

    for (const s of (subs ?? []) as Array<{ endpoint: string; p256dh: string; auth: string; user_id: string }>) {
      // audit15 fix-33: dropped `requireInteraction: true` — lib/web-push.ts
      // PushPayload doesn't declare it and the field would error TypeScript.
      const result = await sendWebPush(
        { endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth },
        { title, body, url, tag },
      ).catch((err) => ({ ok: false, error: err instanceof Error ? err.message : String(err) }));
      if ((result as { ok: boolean }).ok) sent++;
    }
  } catch (err) {
    console.warn('[messenger.call] inline push dispatch failed', {
      call_id: input.callId,
      err: err instanceof Error ? err.message : String(err),
    });
  }

  return sent;
}
