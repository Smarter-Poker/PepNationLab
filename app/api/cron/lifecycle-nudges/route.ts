import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { assertCronAuth, claimCronRun, finishCronRun } from '@/lib/cron';
import { requireAdmin } from '@/lib/admin-auth';
import { emailConfigured, sendWelcomeEmail, sendFirstOrderPromoEmail } from '@/lib/email';
import { enqueuePush } from '@/lib/push-enqueue';
import { notify } from '@/lib/notify';
import { getHouseAgentId } from '@/lib/coupons';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PROMO_CODE = 'FIRST20';

/**
 * Daily lifecycle nudges (owner request 2026-07-14):
 *
 * 1. WELCOME BACKSTOP - house-store researchers (referring agent = the house
 *    'researchstore' profile) created 1h-30d ago who never received a welcome
 *    email (covers Google OAuth signups, which skip /api/storefront/register)
 *    get the extended welcome carrying the FIRST20 first-order promo.
 *
 * 2. FIRST-ORDER PROMO NUDGE - every active researcher who signed up 48h+ ago
 *    and has never placed a non-cancelled order gets ONE email + push with the
 *    FIRST20 code. Abandoned-cart cadence stays with the existing
 *    abandoned-cart-recovery cron; this is the signed-up-never-bought sweep.
 *
 * Both sends are once-per-user, tracked in lifecycle_sends (the dedup row is
 * written BEFORE the send, mirroring abandoned-cart-recovery, so a crash can
 * never replay a send). Email respects email_opt_out; recipient is the
 * verified contact_email when present, else the account's login email.
 */
export async function GET(req: Request) {
  const unauth = assertCronAuth(req);
  if (unauth) return unauth;
  return runLifecycleNudges();
}

/**
 * Manual trigger for the owner: POST with an ADMIN session runs the same
 * sweep on demand (e.g. right after launching a promo), without needing the
 * Vercel CRON_SECRET. Same daily claim applies, so it can never double-send.
 */
export async function POST() {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;
  return runLifecycleNudges();
}

async function runLifecycleNudges(): Promise<NextResponse> {
  const partitionKey = new Date().toISOString().slice(0, 10);
  const claim = await claimCronRun('lifecycle_nudges', partitionKey);
  if (!claim) {
    return NextResponse.json({ skipped: true, reason: 'already_ran', partitionKey });
  }

  try {
    const supabase = createAdminClient();
    const now = Date.now();
    const houseId = await getHouseAgentId(supabase);

    const { data: researchers, error: fetchErr } = await supabase
      .from('profiles')
      .select('id, full_name, first_name, username, email, contact_email, email_verified, email_opt_out, referring_agent_id, created_at, is_active')
      .eq('role', 'researcher')
      // Treat a NULL is_active as active: `.neq(false)` would silently drop
      // NULL rows (SQL three-valued logic), excluding legacy profiles.
      .or('is_active.is.null,is_active.eq.true')
      .limit(1000);

    if (fetchErr) {
      await finishCronRun(claim.id, 'failed', `fetch: ${fetchErr.message}`.slice(0, 500));
      return NextResponse.json({ error: 'fetch_failed' }, { status: 500 });
    }

    const ids = (researchers ?? []).map((r) => r.id);
    if (ids.length === 0) {
      await finishCronRun(claim.id, 'succeeded', 'no_researchers');
      return NextResponse.json({ success: true, welcome: 0, nudge: 0 });
    }

    // Buyers (any non-cancelled order) are excluded from the first-order nudge.
    const { data: orderRows } = await supabase
      .from('orders')
      .select('buyer_id')
      .in('buyer_id', ids)
      .neq('status', 'cancelled')
      .limit(10000);
    const hasOrdered = new Set((orderRows ?? []).map((o) => o.buyer_id as string));

    // Prior lifecycle sends (once-per-user semantics).
    const { data: sentRows } = await supabase
      .from('lifecycle_sends')
      .select('user_id, kind')
      .in('user_id', ids);
    const alreadySent = new Set((sentRows ?? []).map((s) => `${s.user_id}:${s.kind}`));

    // Welcome emails already delivered by the register route (email_log is the
    // source of truth for those, keyed by recipient + template).
    const emails = (researchers ?? [])
      .map((r) => (r.email_verified && r.contact_email ? r.contact_email : r.email))
      .filter(Boolean) as string[];
    const { data: welcomeLog } = emails.length
      ? await supabase
          .from('email_log')
          .select('recipient')
          .in('template', ['welcome', 'welcome_promo'])
          .in('recipient', emails)
      : { data: [] as Array<{ recipient: string }> };
    const welcomed = new Set((welcomeLog ?? []).map((w) => w.recipient.toLowerCase()));

    let welcomeSent = 0;
    let nudgeSent = 0;
    let skipped = 0;
    const canEmail = emailConfigured();

    for (const r of researchers ?? []) {
      const createdMs = r.created_at ? new Date(r.created_at).getTime() : 0;
      const ageMs = now - createdMs;
      const email = (r.email_verified && r.contact_email ? r.contact_email : r.email) as string | null;
      const firstName = (r.first_name || (r.full_name || '').split(' ')[0] || r.username || 'Researcher') as string;

      // 1. Welcome backstop (house-store accounts only, never opted out).
      const isHouse = !!houseId && r.referring_agent_id === houseId;
      if (
        isHouse && canEmail && email && !r.email_opt_out &&
        ageMs > 60 * 60 * 1000 && ageMs < 30 * 24 * 60 * 60 * 1000 &&
        !alreadySent.has(`${r.id}:welcome`) &&
        !welcomed.has(email.toLowerCase())
      ) {
        const { error: dedupErr } = await supabase
          .from('lifecycle_sends')
          .insert({ user_id: r.id, kind: 'welcome' });
        if (!dedupErr) {
          await sendWelcomeEmail({
            to: email,
            fullName: r.full_name,
            username: r.username,
            promoCode: PROMO_CODE,
          }).catch(() => { /* best-effort; email_log records the outcome */ });
          welcomeSent++;
        }
      }

      // 2. First-order promo nudge (48h+ old account, never ordered, once ever).
      if (
        ageMs > 48 * 60 * 60 * 1000 &&
        !hasOrdered.has(r.id) &&
        !alreadySent.has(`${r.id}:first20_nudge`)
      ) {
        const { error: dedupErr } = await supabase
          .from('lifecycle_sends')
          .insert({ user_id: r.id, kind: 'first20_nudge' });
        if (dedupErr) { skipped++; continue; }

        if (canEmail && email && !r.email_opt_out) {
          await sendFirstOrderPromoEmail({
            to: email,
            userId: r.id,
            fullName: r.full_name,
            promoCode: PROMO_CODE,
          }).catch(() => { /* best-effort */ });
        }

        // In-app bell + web push (event 'marketing' has no per-type gate).
        await notify(supabase, {
          userId: r.id,
          type: 'system',
          title: `${PROMO_CODE} = 20% Off Your First Order`,
          body: `Enter Code ${PROMO_CODE} In The Coupon Box At Checkout For 20% Off Your First Research Order. One Use Per Account.`,
          url: '/researchstore',
        }).catch(() => { /* best-effort */ });
        await enqueuePush(supabase, {
          userId: r.id,
          title: `${PROMO_CODE} = 20% Off Your First Order`,
          body: `Use Code ${PROMO_CODE} At Checkout For 20% Off Your First Research Order.`,
          url: '/researchstore',
          event: 'marketing',
          tag: 'first20-nudge',
        }).catch(() => { /* best-effort */ });

        nudgeSent++;
      }
    }

    await finishCronRun(claim.id, 'succeeded', `welcome=${welcomeSent} nudge=${nudgeSent} skipped=${skipped}`);
    return NextResponse.json({ success: true, welcome: welcomeSent, nudge: nudgeSent, skipped, considered: ids.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await finishCronRun(claim.id, 'failed', message.slice(0, 500));
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
