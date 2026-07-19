import { NextResponse } from 'next/server';
import { assertCronAuth, claimCronRun, finishCronRun } from '@/lib/cron';
import { createAdminClient } from '@/lib/supabase/server';
import { notify, notifyOrderAttention, notifyAdmins } from '@/lib/notify';
import { enqueueOrderPush, shortOrderId } from '@/lib/push-enqueue';
import { emailConfigured, sendPaymentReminderEmail, sendOrderAttentionEmail } from '@/lib/email';
import { logOrderEvent } from '@/lib/order-events';
import { PAYMENT_METHOD_LABELS } from '@/lib/payment-method-labels';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/cron/reminders  (every 6 hours; see vercel.json)
 *
 * The order-attention engine. Two jobs, one sweep, and orders are NEVER
 * cancelled - the platform rule (2026-07-19) is that a stale order escalates
 * to humans instead of dying.
 *
 * PART A - Buyer payment reminders (pending_customer_payment):
 *   >= 24h old, no reminder yet  -> reminder #1 (in-app + push + email with
 *                                   the seller's payment handle)
 *   >= 72h old, one reminder     -> reminder #2 (final; same channels)
 *
 * PART B - Agent staleness escalation (order awaiting confirmation):
 *   Applies to pending_customer_payment + agent_approval_pending (agent's
 *   court) and admin_approval_pending (admin's court).
 *   Level 1 (>= 24h): the responsible agent (in-app + push + email) and
 *                     their upline super agent.
 *   Level 2 (>= 48h): agent + upline again, plus ALL admins.
 *   Level 3 (>= 72h): strong admin alert - agent is not confirming.
 *   admin_approval_pending orders escalate straight to admins at 24h.
 *   Each level fires exactly once per order (orders.stale_escalation_level).
 *
 * Auth: Vercel cron Authorization: Bearer ${CRON_SECRET}.
 * Idempotent per 6h window via cron_runs UNIQUE (job_name, partition_key).
 */

const BATCH_LIMIT = 200;
const HOUR_MS = 3600_000;

interface PendingOrder {
  id: string;
  buyer_id: string | null;
  agent_id: string | null;
  status: string;
  total: number | null;
  payment_method: string | null;
  created_at: string;
  payment_reminder_count: number | null;
  stale_escalation_level: number | null;
}

export async function GET(req: Request) {
  const unauth = assertCronAuth(req);
  if (unauth) return unauth;

  const startedAt = new Date();
  // 6-hour partitions: YYYY-MM-DDTHH rounded down to the window start.
  const windowHour = Math.floor(startedAt.getUTCHours() / 6) * 6;
  const partitionKey = `${startedAt.toISOString().slice(0, 10)}T${String(windowHour).padStart(2, '0')}`;
  const claim = await claimCronRun('order_attention', partitionKey);
  if (!claim) {
    return NextResponse.json({ ok: true, skipped: true, reason: 'already_ran_this_window' });
  }

  try {
    const admin = createAdminClient();
    const now = Date.now();

    const { data: rows, error } = await admin
      .from('orders')
      .select('id, buyer_id, agent_id, status, total, payment_method, created_at, payment_reminder_count, stale_escalation_level')
      .in('status', ['pending_customer_payment', 'agent_approval_pending', 'admin_approval_pending'])
      .lt('created_at', new Date(now - 24 * HOUR_MS).toISOString())
      .order('created_at', { ascending: true })
      .limit(BATCH_LIMIT);

    if (error) {
      await finishCronRun(claim.id, 'failed', `query error: ${error.message.slice(0, 180)}`);
      return NextResponse.json({ ok: false, error: 'query failed' }, { status: 500 });
    }

    const orders = (rows ?? []) as PendingOrder[];
    let buyerReminders = 0;
    let escalations = 0;
    let failures = 0;

    // Small caches so a batch does not refetch the same agent/profile rows.
    const agentCache = new Map<string, { full_name: string | null; parent_agent_id: string | null; contact_email: string | null; email_verified: boolean | null }>();
    const handleCache = new Map<string, Record<string, string> | null>();
    const buyerCache = new Map<string, { full_name: string | null; contact_email: string | null; email_verified: boolean | null }>();

    const getAgent = async (id: string) => {
      if (!agentCache.has(id)) {
        const { data } = await admin
          .from('profiles')
          .select('full_name, parent_agent_id, contact_email, email_verified')
          .eq('id', id)
          .maybeSingle();
        agentCache.set(id, data ?? { full_name: null, parent_agent_id: null, contact_email: null, email_verified: null });
      }
      return agentCache.get(id)!;
    };
    const getHandles = async (id: string) => {
      if (!handleCache.has(id)) {
        const { data } = await admin
          .from('agent_profiles')
          .select('payment_handles')
          .eq('id', id)
          .maybeSingle();
        handleCache.set(id, (data?.payment_handles as Record<string, string> | null) ?? null);
      }
      return handleCache.get(id);
    };
    const getBuyer = async (id: string) => {
      if (!buyerCache.has(id)) {
        const { data } = await admin
          .from('profiles')
          .select('full_name, contact_email, email_verified')
          .eq('id', id)
          .maybeSingle();
        buyerCache.set(id, data ?? { full_name: null, contact_email: null, email_verified: null });
      }
      return buyerCache.get(id)!;
    };
    const resolveAgentEmail = async (id: string): Promise<string | null> => {
      const prof = await getAgent(id);
      if (prof.contact_email && prof.email_verified) return prof.contact_email;
      try {
        const { data: authUser } = await admin.auth.admin.getUserById(id);
        return authUser?.user?.email ?? null;
      } catch {
        return null;
      }
    };

    for (const order of orders) {
      const ageHours = (now - new Date(order.created_at).getTime()) / HOUR_MS;
      const short = shortOrderId(order.id);
      const total = Number(order.total) || 0;
      const totalFmt = `$${total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

      // ── PART A: buyer payment reminders ──────────────────────────────────
      try {
        if (order.status === 'pending_customer_payment' && order.buyer_id) {
          const count = Number(order.payment_reminder_count) || 0;
          const due = (ageHours >= 72 && count === 1) || (ageHours >= 24 && count === 0);
          if (due) {
            const methodLabel = order.payment_method
              ? ((PAYMENT_METHOD_LABELS as Record<string, string>)[order.payment_method] ?? order.payment_method)
              : null;
            await notify(admin, {
              userId: order.buyer_id,
              type: 'payment_reminder',
              title: `Order #${short} Is Waiting On Your Payment`,
              body: `Your ${totalFmt} Order Is Reserved And Waiting. Send Your ${methodLabel ?? ''} Payment Whenever You Are Ready - Instructions Are On Your Order Page.`.replace('  ', ' '),
              url: `/orders/${order.id}`,
              withPush: false,
            });
            await enqueueOrderPush(admin, {
              userId: order.buyer_id,
              orderId: order.id,
              event: 'payment_reminder',
            });
            if (emailConfigured()) {
              const buyer = await getBuyer(order.buyer_id);
              if (buyer.contact_email && buyer.email_verified) {
                const handles = order.agent_id ? await getHandles(order.agent_id) : null;
                await sendPaymentReminderEmail({
                  to: buyer.contact_email,
                  fullName: buyer.full_name,
                  orderId: order.id,
                  total,
                  methodLabel,
                  paymentHandle: order.payment_method ? handles?.[order.payment_method] ?? null : null,
                }).catch(() => {});
              }
            }
            await admin
              .from('orders')
              .update({ payment_reminder_count: count + 1, last_payment_reminder_at: new Date().toISOString() })
              .eq('id', order.id);
            await logOrderEvent(admin, {
              orderId: order.id,
              event: 'payment_reminder_sent',
              payload: { reminder_number: count + 1, age_hours: Math.floor(ageHours) },
            });
            buyerReminders++;
          }
        }
      } catch (err) {
        failures++;
        console.error('[order-attention] buyer reminder failed:', order.id, err);
      }

      // ── PART B: staleness escalation ─────────────────────────────────────
      try {
        const level = Number(order.stale_escalation_level) || 0;
        const isAdminCourt = order.status === 'admin_approval_pending';
        let targetLevel = 0;
        if (ageHours >= 72) targetLevel = 3;
        else if (ageHours >= 48) targetLevel = 2;
        else if (ageHours >= 24) targetLevel = 1;
        if (targetLevel <= level) continue;

        if (isAdminCourt) {
          // Admin's court: escalate straight to admins at every new level.
          await notifyAdmins(admin, {
            type: 'order_attention',
            title: `Order #${short} Awaiting Admin Release (${Math.floor(ageHours)}h)`,
            body: `Order #${short} (${totalFmt}) Has Been Waiting On Admin Approval For ${Math.floor(ageHours)} Hours. Review And Release It.`,
            url: `/admin/orders?status=admin_approval_pending`,
          });
        } else if (order.agent_id) {
          const agentProf = await getAgent(order.agent_id);

          // The responsible agent - every level, all channels.
          await notifyOrderAttention(admin, order.agent_id, {
            orderId: order.id,
            shortId: short,
            hoursWaiting: ageHours,
            who: 'agent',
          });
          if (emailConfigured()) {
            const agentEmail = await resolveAgentEmail(order.agent_id);
            if (agentEmail) {
              await sendOrderAttentionEmail({
                to: agentEmail,
                recipientName: agentProf.full_name,
                orderId: order.id,
                hoursWaiting: ageHours,
                total,
              }).catch(() => {});
            }
          }

          // Upline super agent - every level.
          if (agentProf.parent_agent_id) {
            await notifyOrderAttention(admin, agentProf.parent_agent_id, {
              orderId: order.id,
              shortId: short,
              hoursWaiting: ageHours,
              who: 'upline',
              agentName: agentProf.full_name,
            });
            if (emailConfigured()) {
              const uplineEmail = await resolveAgentEmail(agentProf.parent_agent_id);
              if (uplineEmail) {
                const upline = await getAgent(agentProf.parent_agent_id);
                await sendOrderAttentionEmail({
                  to: uplineEmail,
                  recipientName: upline.full_name,
                  orderId: order.id,
                  hoursWaiting: ageHours,
                  total,
                  isUpline: true,
                  agentName: agentProf.full_name,
                }).catch(() => {});
              }
            }
          }

          // Admins - level 2 and up, all the way to the top.
          if (targetLevel >= 2) {
            await notifyAdmins(admin, {
              type: 'order_attention',
              title: targetLevel >= 3
                ? `ESCALATION: Order #${short} Unconfirmed For ${Math.floor(ageHours)}h`
                : `Unconfirmed Order: #${short} (${Math.floor(ageHours)}h)`,
              body: `${agentProf.full_name || 'An Agent'} Has Not Confirmed Order #${short} (${totalFmt}) For ${Math.floor(ageHours)} Hours. Please Follow Up Directly.`,
              url: `/admin/orders?highlight=${order.id}`,
            });
          }
        }

        await admin
          .from('orders')
          .update({ stale_escalation_level: targetLevel, last_stale_escalation_at: new Date().toISOString() })
          .eq('id', order.id);
        await logOrderEvent(admin, {
          orderId: order.id,
          event: 'stale_escalated',
          payload: { level: targetLevel, age_hours: Math.floor(ageHours), status: order.status },
        });
        escalations++;
      } catch (err) {
        failures++;
        console.error('[order-attention] escalation failed:', order.id, err);
      }
    }

    const summary = `buyer reminders: ${buyerReminders}, escalations: ${escalations}, failures: ${failures}, scanned: ${orders.length}`;
    // Note: 'failed' (not 'partial_failure') when anything failed -- the
    // cron_runs status check constraint only allows running/succeeded/failed,
    // and a failed claim is re-claimable so the missed orders get retried.
    // Per-order guards (payment_reminder_count / stale_escalation_level) keep
    // a retry from double-sending what already went out.
    await finishCronRun(claim.id, failures > 0 ? 'failed' : 'succeeded', summary);
    return NextResponse.json({ ok: true, buyerReminders, escalations, failures, scanned: orders.length, partition: partitionKey });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unknown';
    await finishCronRun(claim.id, 'failed', msg.slice(0, 200));
    console.error('[order-attention] crash:', err);
    return NextResponse.json({ ok: false, error: 'internal error' }, { status: 500 });
  }
}
