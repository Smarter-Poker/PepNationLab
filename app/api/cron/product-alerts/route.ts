export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { assertCronAuth, claimCronRun, finishCronRun } from '@/lib/cron';
import { createAdminClient } from '@/lib/supabase/server';
import { sendEmail } from '@/lib/email';

// Dispatches back-in-stock and price-drop notifications. Scheduled in
// vercel.json; CRON_SECRET is enforced in-route by assertCronAuth. Idempotent
// per UTC-hour window via claimCronRun so a retry inside the same window is a
// no-op.

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://pepnationlab.com').replace(/\/$/, '');
const MAX_PER_RUN = 500;

function alertEmail(productName: string, kind: 'back_in_stock' | 'price_drop', href: string): { subject: string; html: string } {
  const heading = kind === 'back_in_stock' ? 'Back In Stock' : 'Price Drop';
  const line = kind === 'back_in_stock'
    ? `${productName} Is Back In Stock At Pep Nation Lab.`
    : `The Price Of ${productName} Just Dropped At Pep Nation Lab.`;
  return {
    subject: `${heading}: ${productName}`,
    html: `<div style="font-family:Inter,Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#0F1923">
      <h1 style="font-size:20px;margin:0 0 12px">${heading}</h1>
      <p style="font-size:15px;line-height:1.5;margin:0 0 20px">${line}</p>
      <a href="${href}" style="display:inline-block;background:#00C4BC;color:#050A0F;font-weight:700;text-decoration:none;padding:12px 22px;border-radius:10px">View Product</a>
      <p style="font-size:12px;color:#6b7785;margin-top:24px">Research Use Only. You Are Receiving This Because You Asked To Be Notified.</p>
    </div>`,
  };
}

export async function GET(req: Request) {
  const unauth = assertCronAuth(req);
  if (unauth) return unauth;

  const partition = new Date().toISOString().slice(0, 13); // YYYY-MM-DDTHH
  const run = await claimCronRun('product_alerts', partition);
  if (!run) {
    return NextResponse.json({ skipped: true, reason: 'already_ran_this_window' });
  }

  const supabase = createAdminClient();
  let notified = 0;
  const notifiedIds: string[] = [];

  try {
    // Pull active alerts with the product and the subscriber's email in one go.
    const { data: alerts, error } = await supabase
      .from('product_alerts')
      .select('id, user_id, product_id, agent_id, alert_type, reference_price, products(name, slug, inventory_count), profiles!product_alerts_user_id_fkey(email)')
      .eq('status', 'active')
      .limit(MAX_PER_RUN);

    if (error) {
      await finishCronRun(run.id, 'failed', error.message);
      return NextResponse.json({ error: 'query_failed' }, { status: 500 });
    }

    for (const a of alerts ?? []) {
      const product: any = (a as any).products;
      const email: string | undefined = (a as any).profiles?.email;
      if (!product || !email) continue;

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
      const { subject, html } = alertEmail(product.name ?? 'A Product', a.alert_type, href);
      const res = await sendEmail({ to: email, subject, html });
      if (res.ok) {
        notified += 1;
        notifiedIds.push(a.id);
      }
    }

    // Mark everything we notified so we do not re-send on the next run.
    if (notifiedIds.length > 0) {
      await supabase
        .from('product_alerts')
        .update({ status: 'notified', notified_at: new Date().toISOString() })
        .in('id', notifiedIds);
    }

    await finishCronRun(run.id, 'succeeded', `notified=${notified}`);
    return NextResponse.json({ ok: true, notified });
  } catch (e: any) {
    await finishCronRun(run.id, 'failed', e?.message ?? 'error');
    return NextResponse.json({ error: 'dispatch_failed' }, { status: 500 });
  }
}
