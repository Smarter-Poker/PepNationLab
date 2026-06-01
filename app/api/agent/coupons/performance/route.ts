import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAgent } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/agent/coupons/performance
 *
 * Per-coupon redemption analytics for the calling agent, keyed by UPPERCASE
 * coupon code:
 *   - redemptions    : non-cancelled orders that used the code
 *   - discount_given : total discount dollars handed out via the code
 *   - revenue_driven : total order value that carried the code
 *
 * Aggregated from orders.coupon_code / discount_amount (not coupons.uses_count),
 * so it reflects realized dollars, not just raw redemption counts.
 */
export async function GET() {
  try {
    const gate = await requireAgent();
    if (!gate.ok) return gate.response;

    const agentId = gate.user.id;
    const svc = await createServiceClient();

    const { data: orders, error } = await svc
      .from('orders')
      .select('coupon_code, total, discount_amount, status')
      .eq('agent_id', agentId)
      .not('coupon_code', 'is', null);

    if (error) {
      console.error('[coupon-perf] error:', error.message);
      return NextResponse.json({ error: 'Failed To Load Coupon Performance.' }, { status: 500 });
    }

    const byCode: Record<string, { redemptions: number; discount_given: number; revenue_driven: number }> = {};
    for (const o of orders ?? []) {
      if (o.status === 'cancelled') continue;
      const raw = (o.coupon_code as string | null) ?? '';
      const code = raw.trim().toUpperCase();
      if (!code) continue;
      const entry = byCode[code] ?? { redemptions: 0, discount_given: 0, revenue_driven: 0 };
      entry.redemptions += 1;
      entry.discount_given += Number(o.discount_amount ?? 0);
      entry.revenue_driven += Number(o.total ?? 0);
      byCode[code] = entry;
    }

    // Round for clean display.
    for (const code of Object.keys(byCode)) {
      byCode[code].discount_given = Number(byCode[code].discount_given.toFixed(2));
      byCode[code].revenue_driven = Number(byCode[code].revenue_driven.toFixed(2));
    }

    return NextResponse.json({ byCode });
  } catch (err) {
    console.error('[coupon-perf] unexpected:', err);
    return NextResponse.json({ error: 'Internal Server Error.' }, { status: 500 });
  }
}
