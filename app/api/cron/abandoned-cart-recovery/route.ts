import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { assertCronAuth, claimCronRun, finishCronRun } from '@/lib/cron';
import { notifyCartReminder } from '@/lib/notify';
import { emailConfigured, sendCartRecoveryEmail } from '@/lib/email';

interface VariantStep {
  hours_after: number;
  subject: string;
  body: string;
  discount_pct?: number;
  free_shipping?: boolean;
}

interface Variant {
  id: string;
  name: string;
  enabled: boolean;
  steps: VariantStep[];
}

/**
 * fix-56 #4: multi-step A/B-tested abandoned cart recovery.
 *
 * Runs every 6 hours. For each researcher with an aged cart:
 *  1. Pick a sticky variant from cart_recovery_variants (id-hash assignment)
 *  2. Count prior reminders to determine current step
 *  3. If the current step's hours_after threshold has elapsed since
 *     cart_updated_at, send that step's message and log it
 *  4. Stop when all steps have been delivered
 *
 * Attribution: when an order is later placed, /api/orders updates
 * abandoned_cart_reminders.recovered_order_id matching that user - the
 * admin dashboard reads sent vs recovered to compute win rate.
 */
export async function GET(req: Request) {
  const unauth = assertCronAuth(req);
  if (unauth) return unauth;

  const partitionKey = new Date().toISOString().slice(0, 13);
  const claim = await claimCronRun('abandoned_cart_recovery', partitionKey);
  if (!claim) {
    return NextResponse.json({ skipped: true, reason: 'already_ran', partitionKey });
  }

  try {
    const supabase = createAdminClient();
    const now = new Date();

    // Load enabled variants
    const { data: variantRows, error: varErr } = await supabase
      .from('cart_recovery_variants')
      .select('id, name, enabled, steps')
      .eq('enabled', true)
      .order('created_at', { ascending: true });

    if (varErr || !variantRows || variantRows.length === 0) {
      await finishCronRun(claim.id, 'succeeded', 'no_enabled_variants');
      return NextResponse.json({ skipped: true, reason: 'no_enabled_variants' });
    }
    const variants = variantRows as unknown as Variant[];

    // Candidates: researchers with non-empty cart that's at least 24h old
    // and not touched in the last 14d
    const cutoff24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const cutoff14d = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();

    const { data: candidates, error: fetchError } = await supabase
      .from('profiles')
      .select('id, full_name, cart_state, cart_updated_at, contact_email, email_verified, email_opt_out')
      .eq('role', 'researcher')
      .not('cart_state', 'is', null)
      .neq('cart_state', '[]')
      .lt('cart_updated_at', cutoff24h)
      .gt('cart_updated_at', cutoff14d)
      .limit(200);

    if (fetchError) {
      await finishCronRun(claim.id, 'failed', `fetch: ${fetchError.message}`.slice(0, 500));
      return NextResponse.json({ error: 'fetch_failed' }, { status: 500 });
    }

    let sent = 0;
    let skipped = 0;
    const candidateIds = (candidates ?? []).map((c) => c.id);

    // Bulk-fetch reminder history for all candidates in one query
    const { data: priorRows } = candidateIds.length > 0
      ? await supabase
          .from('abandoned_cart_reminders')
          .select('user_id, variant_name, step_index')
          .in('user_id', candidateIds)
      : { data: [] as any[] };

    const historyByUser = new Map<string, Array<{ variant_name: string | null; step_index: number }>>();
    for (const row of priorRows ?? []) {
      const k = (row as any).user_id as string;
      const arr = historyByUser.get(k) ?? [];
      arr.push({ variant_name: (row as any).variant_name ?? null, step_index: Number((row as any).step_index) || 0 });
      historyByUser.set(k, arr);
    }

    for (const candidate of candidates ?? []) {
      // Sticky variant assignment via id-hash
      let hash = 0;
      for (let i = 0; i < candidate.id.length; i++) hash = (hash * 31 + candidate.id.charCodeAt(i)) | 0;
      const variant = variants[Math.abs(hash) % variants.length];

      // What step are we on? Count distinct prior step_index values for this
      // variant. nextStep is the smallest step we haven't sent yet.
      const history = (historyByUser.get(candidate.id) ?? []).filter((h) => h.variant_name === variant.name);
      const sentSteps = new Set(history.map((h) => h.step_index));
      let nextStep = -1;
      for (let i = 0; i < variant.steps.length; i++) {
        if (!sentSteps.has(i)) { nextStep = i; break; }
      }
      if (nextStep === -1) { skipped++; continue; } // all steps sent

      // Time check: enforce hours_after on this step relative to cart_updated_at
      const step = variant.steps[nextStep];
      const earliest = new Date(new Date(candidate.cart_updated_at!).getTime() + (Number(step.hours_after) || 0) * 60 * 60 * 1000);
      if (earliest > now) { skipped++; continue; }

      // Validate cart still has items
      let cartItems: Array<{ retailPrice?: number; quantity?: number }> = [];
      try {
        cartItems = typeof candidate.cart_state === 'string'
          ? JSON.parse(candidate.cart_state)
          : (candidate.cart_state as typeof cartItems);
      } catch { skipped++; continue; }
      if (!Array.isArray(cartItems) || cartItems.length === 0) { skipped++; continue; }

      const cartValue = cartItems.reduce((s, it) => s + (Number(it?.retailPrice) || 0) * (Number(it?.quantity) || 0), 0);
      const itemCount = cartItems.reduce((s, it) => s + (Number(it?.quantity) || 0), 0);

      // Personalize body
      const firstName = candidate.full_name ? String(candidate.full_name).split(' ')[0] : 'Researcher';
      let body = (step.body || '').replace(/\{name\}/g, firstName);
      if (step.discount_pct) body += `\n\nOffer: ${step.discount_pct}% Off Your Order.`;
      if (step.free_shipping) body += `\n\nOffer: Free Shipping On Your Order.`;
      const subject = step.subject || 'You Left Items In Your Cart';

      // Write the dedup row FIRST. Every channel below (in-app message, bell,
      // email) is gated behind this row, so a crash or partial failure can
      // never replay the same step on the next run. Previously the in-app
      // message + bell fired before this row existed; a failed insert meant
      // they re-sent every 6 hours forever.
      const { error: reminderErr } = await supabase.from('abandoned_cart_reminders').insert({
        user_id: candidate.id,
        cart_state_snapshot: candidate.cart_state,
        cart_value: cartValue || null,
        channel: 'in_app',
        variant_name: variant.name,
        step_index: nextStep,
      });

      if (reminderErr) {
        console.error('[abandoned-cart-recovery] reminder insert failed for user', candidate.id, reminderErr);
        skipped++;
        continue;
      }

      // In-app copies (best-effort after the dedup row is committed).
      const { error: msgError } = await supabase.from('internal_messages').insert({
        sender_id: null,
        receiver_id: candidate.id,
        subject,
        body,
        type: 'notification',
        is_read: false,
      });
      if (msgError) {
        console.error('[abandoned-cart-recovery] internal message insert failed for user', candidate.id, msgError);
      }

      await notifyCartReminder(supabase, candidate.id, itemCount, cartValue).catch(() => { /* best-effort */ });

      // Mirror the reminder to the researcher's inbox. MARKETING send: only to
      // a verified, non-opted-out contact email, and AWAITED so the serverless
      // runtime cannot drop it after the response is flushed. Carries a
      // one-click unsubscribe (userId) per CAN-SPAM / RFC 8058.
      if (
        emailConfigured() &&
        (candidate as any).contact_email &&
        (candidate as any).email_verified &&
        !(candidate as any).email_opt_out
      ) {
        await sendCartRecoveryEmail({
          to: (candidate as any).contact_email,
          fullName: candidate.full_name,
          subject,
          body,
          userId: candidate.id,
        }).catch(() => { /* best-effort */ });
      }

      await supabase
        .from('profiles')
        .update({ last_cart_reminder_at: new Date().toISOString() })
        .eq('id', candidate.id);

      sent++;
    }

    await finishCronRun(claim.id, 'succeeded', `sent=${sent} skipped=${skipped}`);
    return NextResponse.json({ success: true, sent, skipped, considered: candidates?.length ?? 0 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await finishCronRun(claim.id, 'failed', message.slice(0, 500));
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
