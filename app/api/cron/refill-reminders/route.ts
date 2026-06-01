/**
 * GET /api/cron/refill-reminders
 *
 * Global 21-day refill / reorder drip (platform-wide auto-deploy — no per-agent
 * toggle). Once a day this finds fulfilled orders that are ~21 days old and, for
 * each buyer, sends:
 *   1. A web push + in-app bell notification (gated by the refill_reminder push
 *      type, which is default-on but individually opt-out-able).
 *   2. A conversational Messenger direct message FROM the agent who sold the
 *      order, nudging the researcher to reorder.
 *
 * Email is intentionally NOT used — email is disabled platform-wide.
 *
 * Idempotency:
 *   - claimCronRun('refill_reminders', YYYY-MM-DD) ensures one run per day.
 *   - orders.refill_reminder_sent_at is stamped per order so a re-trigger or a
 *     buyer's multiple orders never double-message anyone.
 *
 * Window: created_at in [today-23d, today-21d). The 3-day look-back lets a
 * missed cron day catch up without ever blasting the historical backlog, and
 * the sent flag de-dupes within that window.
 */
import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { assertCronAuth, claimCronRun, finishCronRun } from '@/lib/cron';
import { notifyRefillReminder } from '@/lib/notify';
import { sendBroadcast } from '@/lib/messenger/broadcast';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Statuses that represent an order the buyer actually received product for.
const FULFILLED_STATUSES = ['shipped', 'delivered', 'approved_pickup'] as const;

const DAY_MS = 24 * 60 * 60 * 1000;

function firstNameOf(buyerName: string | null): string {
  if (!buyerName) return 'there';
  const trimmed = buyerName.trim();
  if (!trimmed) return 'there';
  return trimmed.split(/\s+/)[0];
}

export async function GET(req: Request) {
  const unauth = assertCronAuth(req);
  if (unauth) return unauth;

  const now = new Date();
  const partitionKey = now.toISOString().slice(0, 10); // YYYY-MM-DD

  const claim = await claimCronRun('refill_reminders', partitionKey);
  if (!claim) {
    return NextResponse.json({ skipped: true, reason: 'already_ran' });
  }

  const windowStart = new Date(now.getTime() - 23 * DAY_MS).toISOString();
  const windowEnd = new Date(now.getTime() - 21 * DAY_MS).toISOString();

  let buyersReminded = 0;
  let messengerSent = 0;
  let ordersMarked = 0;

  try {
    const svc = await createServiceClient();

    const { data: orders, error } = await svc
      .from('orders')
      .select('id, buyer_id, agent_id, buyer_name, created_at')
      .in('status', FULFILLED_STATUSES as unknown as string[])
      .is('refill_reminder_sent_at', null)
      .gte('created_at', windowStart)
      .lt('created_at', windowEnd)
      .not('buyer_id', 'is', null)
      .not('agent_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1000);

    if (error) {
      await finishCronRun(claim.id, 'failed', `query: ${error.message}`.slice(0, 500));
      return NextResponse.json({ error: 'query_failed' }, { status: 500 });
    }

    // Group by buyer so a buyer with several orders in the window is reminded
    // once. The most recent eligible order supplies the agent + display name;
    // every eligible order for that buyer is stamped as sent.
    const byBuyer = new Map<
      string,
      { agentId: string; buyerName: string | null; orderIds: string[] }
    >();
    for (const o of orders ?? []) {
      const buyerId = o.buyer_id as string;
      const existing = byBuyer.get(buyerId);
      if (existing) {
        existing.orderIds.push(o.id as string);
      } else {
        byBuyer.set(buyerId, {
          agentId: o.agent_id as string,
          buyerName: (o.buyer_name as string | null) ?? null,
          orderIds: [o.id as string],
        });
      }
    }

    for (const [buyerId, info] of byBuyer) {
      const who = firstNameOf(info.buyerName);
      try {
        // 1. Push + in-app bell (best-effort, never throws)
        await notifyRefillReminder(svc, buyerId, who);

        // 2. Messenger DM from the selling agent
        const dmBody = `Hey ${who}, just checking in to see how your research is going. Let me know if you need to restock anything!`;
        const sent = await sendAgentRefillDm(svc, info.agentId, buyerId, dmBody);
        if (sent) messengerSent++;

        buyersReminded++;
      } catch (err) {
        console.error('[refill-reminders] buyer failed:', buyerId, err);
      }

      // 3. Stamp every eligible order for this buyer as reminded — even if the
      // DM failed — so the drip never loops and re-spams.
      const { error: markErr } = await svc
        .from('orders')
        .update({ refill_reminder_sent_at: new Date().toISOString() })
        .in('id', info.orderIds);
      if (!markErr) ordersMarked += info.orderIds.length;
    }

    await finishCronRun(
      claim.id,
      'succeeded',
      `buyers=${buyersReminded} dm=${messengerSent} marked=${ordersMarked}`,
    );
    return NextResponse.json({
      success: true,
      buyersReminded,
      messengerSent,
      ordersMarked,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    await finishCronRun(claim.id, 'failed', msg.slice(0, 500));
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * Find-or-create the direct conversation between the agent and the buyer, then
 * post the reminder as a message from the agent and broadcast it so any open
 * Messenger / unread badge updates live. Returns true if the message landed.
 */
async function sendAgentRefillDm(
  svc: Awaited<ReturnType<typeof createServiceClient>>,
  agentId: string,
  buyerId: string,
  body: string,
): Promise<boolean> {
  try {
    // Reuse the existing 1:1 thread if one exists.
    let conversationId: string | null = null;
    const { data: existing } = await svc.rpc('fn_find_direct_conversation', {
      a: agentId,
      b: buyerId,
    });
    conversationId = (existing as string | null) ?? null;

    if (!conversationId) {
      const { data: created, error: createErr } = await svc.rpc(
        'fn_messenger_create_conversation',
        {
          p_caller_id: agentId,
          p_type: 'direct',
          p_title: null,
          p_avatar: null,
          p_participant_ids: [agentId, buyerId],
        },
      );
      if (createErr || !created) return false;
      conversationId = created as string;
    }

    const { data: inserted, error: insErr } = await svc
      .from('messenger_messages')
      .insert({
        conversation_id: conversationId,
        sender_id: agentId,
        text: body,
        message_type: 'text',
      })
      .select('*')
      .maybeSingle();

    if (insErr || !inserted) return false;

    // Live-update any open Messenger UI for the buyer + the conversation pane.
    await sendBroadcast([
      {
        topic: `conversation:${conversationId}`,
        event: 'new_message',
        payload: { message: inserted },
      },
      {
        topic: `user_notify:${buyerId}`,
        event: 'new_message_notify',
        payload: { message: inserted },
      },
    ]);

    // Push the buyer's updated unread participant row to refresh the red badge.
    const { data: participant } = await svc
      .from('messenger_participants')
      .select('*')
      .eq('conversation_id', conversationId)
      .eq('user_id', buyerId)
      .maybeSingle();
    if (participant) {
      await sendBroadcast({
        topic: `user_unread:${buyerId}`,
        event: 'participant_updated',
        payload: { participant },
      });
    }

    return true;
  } catch (err) {
    console.error('[refill-reminders] dm failed:', agentId, buyerId, err);
    return false;
  }
}
