import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin-auth';
import { rateLimit, getClientIp } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * fix-53 (Option B): operational nudges for the /admin/search empty
 * state. Returns a small set of counts admins act on regularly so the
 * page is useful before any query is typed.
 *
 * Single RPC round trip (fn_admin_operational_nudges) — five COUNTs
 * run server-side and come back as one row. Cache-Control: 30s
 * private + 60s SWR so a quick succession of /admin/search visits
 * doesn't re-scan five tables.
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

  // Postgres bigint serializes as string over PostgREST — coerce here so
  // the client just sees numbers.
  const row = (data ?? {}) as Record<string, number | string | null>;
  const num = (v: unknown): number => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  const res = NextResponse.json({
    pendingCustomerPayment:   num(row.pending_customer_payment),
    agentApprovalPending:     num(row.agent_approval_pending),
    expiredActiveCoupons:     num(row.expired_active_coupons),
    researchersFirstLogin:    num(row.researchers_first_login),
    activeAgentsNoWarehouse:  num(row.active_agents_no_warehouse),
  });
  res.headers.set('Cache-Control', 'private, max-age=30, stale-while-revalidate=60');
  return res;
}
