import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { assertCronAuth } from '@/lib/cron';
import { recomputeBillingForCancelledOrder } from '@/lib/statement-recompute';
import { notifyAdmins } from '@/lib/notify';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

/**
 * Nightly safety net for billed-then-cancelled orders.
 *
 * Every cancel path now calls recomputeBillingForCancelledOrder inline, but
 * that call is deliberately best-effort: the cancel itself is already
 * committed by the time it runs, so it must never be allowed to fail the
 * request. That leaves a window - a timeout, a transient DB error, a cancel
 * applied directly in SQL, or an order cancelled by a path written in future -
 * where a cancelled order stays inside a bill.
 *
 * This job closes that window by working from state rather than from events:
 * it looks for any cancelled order still attached to a statement and re-runs
 * the settlement. Because the recompute reads live data instead of applying a
 * delta, running it again on an already-corrected statement is a no-op.
 *
 * Deliberately capped per run. A backlog drains over consecutive nights rather
 * than risking a 300s timeout mid-sweep, and the count is reported so a real
 * backlog is visible instead of silently truncated.
 */
const MAX_ORDERS_PER_RUN = 200;

export async function GET(req: NextRequest) {
  const unauth = assertCronAuth(req);
  if (unauth) return unauth;

  const svc = createAdminClient();

  let scanned = 0;
  let corrected = 0;
  let creditsRecorded = 0;
  let invoicesCorrected = 0;
  const errors: string[] = [];

  try {
    // Cancelled orders that a statement still claims. statement_orders is
    // rewritten wholesale by persistStatement, so a corrected statement drops
    // its link and stops matching here - the query is self-clearing.
    // Deterministic ordering. Without it the 200-slot budget was filled by
    // whatever Postgres happened to return, and rows that can never clear
    // (a cancelled order attached to a PAID statement keeps its link by
    // design) could crowd out genuinely-broken new ones forever.
    const { data: links, error: linkErr } = await svc
      .from('statement_orders')
      .select('order_id, statement_id, orders!inner(id, status)')
      .eq('orders.status', 'cancelled')
      .order('order_id', { ascending: true })
      .limit(MAX_ORDERS_PER_RUN + 1);

    if (linkErr) {
      console.error('[statement-reconcile] link query failed:', linkErr.message);
      return NextResponse.json({ error: 'query_failed' }, { status: 500 });
    }

    const rows = links ?? [];

    // Orders already credited on a paid statement are permanently done - the
    // link stays by design (a settled bill must keep saying what it was for),
    // so they would re-match every night forever. Drop them before spending
    // any of the run budget on them.
    const { data: settled } = await svc
      .from('statement_adjustments')
      .select('order_id')
      .not('order_id', 'is', null);
    const alreadyCredited = new Set(
      (settled ?? []).map((a: { order_id: string | null }) => a.order_id).filter(Boolean) as string[]
    );

    const candidates = Array.from(
      new Set(rows.map((r: { order_id: string }) => r.order_id))
    ).filter((id) => !alreadyCredited.has(id));

    const truncated = candidates.length > MAX_ORDERS_PER_RUN;
    const orderIds = candidates.slice(0, MAX_ORDERS_PER_RUN);

    for (const orderId of orderIds) {
      scanned++;
      const outcome = await recomputeBillingForCancelledOrder(svc, orderId, null);
      corrected += outcome.corrected.length;
      creditsRecorded += outcome.creditsRecorded.length;
      invoicesCorrected += outcome.invoicesCorrected.length;
      for (const e of outcome.errors) errors.push(`${orderId}: ${e}`);
    }

    // Anything corrected here escaped the inline path, which means a real
    // failure happened somewhere. Say so rather than quietly fixing it.
    if (corrected > 0 || creditsRecorded > 0 || invoicesCorrected > 0) {
      await notifyAdmins(svc, {
        type: 'system',
        title: 'Billing Reconciler Corrected A Statement',
        body:
          `${corrected} statement(s) and ${invoicesCorrected} invoice(s) were re-settled for cancelled orders, ` +
          `and ${creditsRecorded} credit(s) were recorded on already-paid statements. ` +
          `These should have been corrected at cancel time - worth a look at why they were not.`,
        url: '/admin/statements',
      }).catch(() => { /* best-effort */ });
    }

    // Errors used to be accumulated and returned in the HTTP body, which for a
    // Vercel cron means returned to nobody. Anything that fails here has
    // already failed once at cancel time (the inline call is best-effort), so
    // a silent second failure is how a mis-billed statement becomes permanent.
    if (errors.length > 0 || truncated) {
      await notifyAdmins(svc, {
        type: 'system',
        title: 'Billing Reconciler Needs Attention',
        body:
          (errors.length > 0
            ? `${errors.length} statement(s) could not be re-settled automatically. First: ${errors[0]}. `
            : '') +
          (truncated
            ? `More than ${MAX_ORDERS_PER_RUN} cancelled orders are still attached to bills; the rest run tomorrow.`
            : ''),
        url: '/admin/statements',
      }).catch(() => { /* best-effort */ });

      console.warn('[statement-reconcile] errors:', errors.slice(0, 25), 'truncated:', truncated);
    }

    return NextResponse.json({
      success: true,
      scanned,
      corrected,
      creditsRecorded,
      invoicesCorrected,
      truncated,
      errors: errors.slice(0, 25),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[statement-reconcile] failed:', message);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
