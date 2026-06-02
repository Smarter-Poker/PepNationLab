/**
 * GET /api/cron/inventory-alerts  (R26)
 *
 * Daily low-stock surveillance for agents.
 *
 * For every agent_inventory row where `stock_count <= low_stock_threshold`
 * (default 5, configurable per row by the agent), drop a `low_stock` row into
 * `notifications` so the bell in the agent's navbar pings. The agent learns
 * they're running out before a buyer hits "Add To Cart" on an out-of-stock
 * SKU, and can restock from the in-app dashboard.
 *
 * Throttling: `agent_inventory.low_stock_alerted_at` is stamped at write time.
 * The query filters rows where it is NULL OR older than 24 hours, so a
 * persistently-low SKU pings the agent at most once per day instead of every
 * cron tick.
 *
 * Idempotency: `claimCronRun('inventory_alerts', YYYY-MM-DD)` keeps a
 * re-trigger inside the same UTC day from running the body twice.
 *
 * Push delivery: writing to `notifications` is enough — push is delivered by
 * /api/cron/push-dispatch which reads the table and respects per-type prefs.
 * The `low_stock` push type defaults ON; agents can mute it from
 * /account/notifications if they want to.
 */
import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { assertCronAuth, claimCronRun, finishCronRun } from '@/lib/cron';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const THROTTLE_HOURS = 24;

interface InventoryRow {
  id: string;
  agent_id: string;
  product_id: string;
  stock_count: number;
  low_stock_threshold: number;
  low_stock_alerted_at: string | null;
}

export async function GET(req: Request) {
  const unauth = assertCronAuth(req);
  if (unauth) return unauth;

  const now = new Date();
  const partitionKey = now.toISOString().slice(0, 10); // YYYY-MM-DD

  const claim = await claimCronRun('inventory_alerts', partitionKey);
  if (!claim) {
    return NextResponse.json({ skipped: true, reason: 'already_ran' });
  }

  let alertsWritten = 0;
  let agentsTouched = 0;
  let rowsScanned = 0;
  let finishStatus: 'succeeded' | 'failed' = 'succeeded';
  let finishNotes: string | undefined;

  try {
    const service = await createServiceClient();
    const throttleCutoff = new Date(
      now.getTime() - THROTTLE_HOURS * 60 * 60 * 1000,
    );

    // Supabase's REST builder can't express "stock_count <= column" in a
    // single filter. Pull all rows and filter in memory. The table is tiny
    // per agent and even at platform scale stays well under 10k rows.
    const { data: allRows, error: scanErr } = await service
      .from('agent_inventory')
      .select(
        'id, agent_id, product_id, stock_count, low_stock_threshold, low_stock_alerted_at',
      );
    if (scanErr) {
      finishStatus = 'failed';
      finishNotes = `scan: ${scanErr.message}`.slice(0, 500);
      await finishCronRun(claim.id, finishStatus, finishNotes);
      return NextResponse.json({ error: 'scan_failed' }, { status: 500 });
    }
    rowsScanned = (allRows ?? []).length;

    const eligible: InventoryRow[] = (allRows ?? []).filter((r: InventoryRow) => {
      if (r.stock_count == null || r.low_stock_threshold == null) return false;
      if (r.stock_count > r.low_stock_threshold) return false;
      if (!r.low_stock_alerted_at) return true;
      return new Date(r.low_stock_alerted_at).getTime() < throttleCutoff.getTime();
    });

    const result = await writeAlerts(service, eligible);
    alertsWritten = result.alertsWritten;
    agentsTouched = result.agentsTouched;
  } catch (err) {
    finishStatus = 'failed';
    finishNotes = err instanceof Error ? err.message.slice(0, 500) : 'unknown';
  } finally {
    await finishCronRun(claim.id, finishStatus, finishNotes);
  }

  return NextResponse.json({
    ok: true,
    rowsScanned,
    alertsWritten,
    agentsTouched,
    at: now.toISOString(),
  });
}

async function writeAlerts(
  service: Awaited<ReturnType<typeof createServiceClient>>,
  rows: InventoryRow[],
): Promise<{ alertsWritten: number; agentsTouched: number }> {
  if (rows.length === 0) return { alertsWritten: 0, agentsTouched: 0 };

  // Look up product names so the alert is human-readable.
  const productIds = Array.from(new Set(rows.map((r) => r.product_id)));
  const { data: products } = await service
    .from('products')
    .select('id, name, slug')
    .in('id', productIds);
  const productById = new Map(
    (products ?? []).map((p) => [p.id, p as { id: string; name: string; slug: string | null }]),
  );

  const nowIso = new Date().toISOString();
  const notificationRows: Array<{
    user_id: string;
    type: string;
    title: string;
    body: string;
    url: string;
  }> = [];
  const rowIdsToStamp: string[] = [];
  const agentSet = new Set<string>();

  for (const row of rows) {
    const product = productById.get(row.product_id);
    if (!product) continue;
    const stockLabel =
      row.stock_count === 0 ? 'Out Of Stock' : `${row.stock_count} Left`;
    notificationRows.push({
      user_id: row.agent_id,
      type: 'low_stock',
      title: `Low Stock: ${product.name}`,
      body: `${stockLabel} (Threshold ${row.low_stock_threshold}). Restock To Avoid Buyer Surprises.`,
      url: '/dashboard/agent?tab=Inventory',
    });
    rowIdsToStamp.push(row.id);
    agentSet.add(row.agent_id);
  }

  if (notificationRows.length === 0) return { alertsWritten: 0, agentsTouched: 0 };

  const { error: insertErr } = await service
    .from('notifications')
    .insert(notificationRows);
  if (insertErr) {
    return { alertsWritten: 0, agentsTouched: 0 };
  }

  const { error: stampErr } = await service
    .from('agent_inventory')
    .update({ low_stock_alerted_at: nowIso })
    .in('id', rowIdsToStamp);
  if (stampErr) {
    // Insert already succeeded; return the counts truthfully even if the
    // throttle stamp didn't land. Worst case the next tick re-alerts; we
    // don't want to silently drop a real "alert was sent" count.
    return {
      alertsWritten: notificationRows.length,
      agentsTouched: agentSet.size,
    };
  }

  return {
    alertsWritten: notificationRows.length,
    agentsTouched: agentSet.size,
  };
}
