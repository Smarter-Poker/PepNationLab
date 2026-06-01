import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin-auth';
import { rateLimit, getClientIp } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * fix-53 / fix-54: operational nudges for the /admin/search empty
 * state. Returns 11 actionable bigint counts in one RPC round trip.
 * The client only renders rows whose count > 0, so a clean platform
 * shows nothing.
 *
 * Categories:
 *   Orders        — pending_customer_payment, agent_approval_pending,
 *                   stale_approved_ship, shipped_no_tracking
 *   Inventory     — out_of_stock_active_products
 *   Financial     — negative_prepaid_balance, open_statements_past_due
 *   Coupons       — expired_active_coupons
 *   Researchers   — researchers_first_login, abandoned_carts
 *   Agent setup   — active_agents_no_warehouse
 *
 * Cache-Control: 30s private + 60s SWR.
 */
export async function GET(req: NextRequest) {
  const adminCheck = await requireAdmin();
  if (!adminCheck.ok) {
    return NextResponse.json({ error: adminCheck.error ?? 'Unauthorized' }, { status: adminCheck.status ?? 401 });
  }

  const ip = getClientIp(req);
  const limited = await rateLimit({
    key: 'admin_op_nudges',
    limit: 60,
    windowSeconds: 60,
    identifier: adminCheck.userId || ip,
  });
  if (!limited.allowed) {
    return NextResponse.json({ error: 'Rate Limit Exceeded' }, { status: 429 });
  }

  const svc = await createServiceClient();
  const { data, error } = await svc.rpc('fn_admin_operational_nudges').single();
  if (error) {
    return NextResponse.json({ error: 'Nudges Query Failed' }, { status: 500 });
  }

  // Postgres bigint serializes as string over PostgREST — coerce here.
  // Null/undefined → 0 so an older DB function shape never throws here.
  const row = (data ?? {}) as Record<string, number | string | null>;
  const num = (v: unknown): number => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  const res = NextResponse.json({
    // Original five (kept for backward compat)
    pendingCustomerPayment:    num(row.pending_customer_payment),
    agentApprovalPending:      num(row.agent_approval_pending),
    expiredActiveCoupons:      num(row.expired_active_coupons),
    researchersFirstLogin:     num(row.researchers_first_login),
    activeAgentsNoWarehouse:   num(row.active_agents_no_warehouse),
    // fix-54: six new nudges
    staleApprovedShip:         num(row.stale_approved_ship),
    shippedNoTracking:         num(row.shipped_no_tracking),
    outOfStockActiveProducts:  num(row.out_of_stock_active_products),
    negativePrepaidBalance:    num(row.negative_prepaid_balance),
    openStatementsPastDue:     num(row.open_statements_past_due),
    abandonedCarts:            num(row.abandoned_carts),
  });
  res.headers.set('Cache-Control', 'private, max-age=30, stale-while-revalidate=60');
  return res;
}
