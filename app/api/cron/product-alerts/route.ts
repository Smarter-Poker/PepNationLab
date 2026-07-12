export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { assertCronAuth, claimCronRun, finishCronRun } from '@/lib/cron';
import { createAdminClient } from '@/lib/supabase/server';
import { emailConfigured, sendProductAlertEmail } from '@/lib/email';

// Dispatches back-in-stock and price-drop notifications. Scheduled in
// vercel.json; CRON_SECRET is enforced in-route by assertCronAuth. Idempotent
// per UTC-hour window via claimCronRun so a retry inside the same window is a
// no-op.

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://pepnationlab.com').replace(/\/$/, '');
// 200 per run: sends are throttled to respect the provider's ~2 req/s rate
// limit, so a full batch stays well inside the cron's 300s maxDuration.
const MAX_PER_RUN = 200;

export async function GET(req: Request) {
  const unauth = assertCronAuth(req);
  if (unauth) return unauth;

  const partition = new Date().toISOString().slice(0, 13); // YYYY-MM-DDTHH
  const run = await claimCronRun('product_alerts', partition);
  if (!run) {
    return NextResponse.json({ skipped: true, reason: 'already_ran_this_window' });
  }

  // Without a configured sender every send would be a skipped no-op; bail out
  // instead of consuming subscriber rows or spinning the loop for nothing.
  if (!emailConfigured()) {
    await finishCronRun(run.id, 'succeeded', 'email_not_configured');
    return NextResponse.json({ skipped: true, reason: 'email_not_configured' });
  }

  const supabase = createAdminClient();
  let notified = 0;

  try {
    // Pull active alerts with the product and the subscriber's email in one go.
    const { data: alerts, error } = await supabase
      .from('product_alerts')
      .select('id, user_id, product_id, agent_id, alert_type, reference_price, products(name, slug, inventory_count), profiles!product_alerts_user_id_fkey(contact_email, email_verified, email_opt_out)')
      .eq('status', 'active')
      .limit(MAX_PER_RUN);

    if (error) {
      await finishCronRun(run.id, 'failed', error.message);
      return NextResponse.json({ error: 'query_failed' }, { status: 500 });
    }

    for (const a of alerts ?? []) {
      const product: any = (a as any).products;
      const prof: any = (a as any).profiles;
      // Verified, non-opted-out contact_email ONLY. profiles.email is null for
      // self-registered researchers (the real address lives on contact_email),
      // so the old profiles.email lookup silently skipped most subscribers --
      // and when it did resolve, it could hit an unverified agent-entered
      // address, hurting deliverability.
      const email: string | undefined = prof?.contact_email || undefined;
      if (!product || !email || !prof?.email_verified || prof?.email_opt_out) continue;

      let shouldNotify = false;

      if (a.alert_type === 'back_in_stock') {
        shouldNotify = Number(product.inventory_count ?? 0) > 0;
      } else if (a.alert_type === 'price_drop' && a.reference_price != null && a.agent_id) {
        const { data: ap } = await supabase
          .from('agent_products')
          .select('retail_price, is_on_sale, sale_price')
          .eq('agent_id', a.agent_id)
          .eq('product_id', a.product_id)
          .maybeSingle();
        if (ap) {
          const effective = (ap.is_on_sale && ap.sale_price != null ? Number(ap.sale_price) : Number(ap.retail_price)) / 10;
          shouldNotify = Number.isFinite(effective) && effective < Number(a.reference_price);
        }
      }

      if (!shouldNotify) continue;

      const href = product.slug ? `${APP_URL}/products/${product.slug}` : APP_URL;
      const res = await sendProductAlertEmail({
        to: email,
        userId: a.user_id,
        productName: product.name ?? 'A Product',
        kind: a.alert_type as 'back_in_stock' | 'price_drop',
        href,
      });
      // Mark each alert notified IMMEDIATELY after its own successful send.
      // The old end-of-loop batch update meant a mid-run crash re-sent every
      // already-delivered alert on the next window. A skipped (unconfigured)
      // send must NOT mark, or subscriptions would be consumed with no email.
      if (res.ok && !res.skipped) {
        await supabase
          .from('product_alerts')
          .update({ status: 'notified', notified_at: new Date().toISOString() })
          .eq('id', a.id);
        notified += 1;
      }
      // Throttle to stay under the provider's ~2 req/s rate limit.
      await new Promise((resolve) => setTimeout(resolve, 600));
    }

    await finishCronRun(run.id, 'succeeded', `notified=${notified}`);
    return NextResponse.json({ ok: true, notified });
  } catch (e: any) {
    await finishCronRun(run.id, 'failed', e?.message ?? 'error');
    return NextResponse.json({ error: 'dispatch_failed' }, { status: 500 });
  }
}
