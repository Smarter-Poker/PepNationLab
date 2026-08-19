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
    const { data: links, error: linkErr } = await svc
      .from('statement_orders')
      .select('order_id, statement_id, orders!inner(id, status)')
      .eq('orders.status', 'cancelled')
      .limit(MAX_ORDERS_PER_RUN + 1);

    if (linkErr) {
      console.error('[statement-reconcile] link query failed:', linkErr.message);
      return NextResponse.json({ error: 'query_failed' }, { status: 500 });
    }

    const rows = links ?? [];
    const truncated = rows.length > MAX_ORDERS_PER_RUN;
    const orderIds = Array.from(
      new Set(rows.slice(0, MAX_ORDERS_PER_RUN).map((r: { order_id: string }) => r.order_id))
    );

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

    if (truncated) {
      console.warn(
        `[statement-reconcile] hit the ${MAX_ORDERS_PER_RUN}-order cap; more remain and will be picked up on the next run`
      );
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
