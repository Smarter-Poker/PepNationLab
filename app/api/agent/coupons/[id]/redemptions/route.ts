import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAgent } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/agent/coupons/[id]/redemptions
 *
 * Returns every redemption of the coupon - buyer (researcher) name,
 * order id, order date, subtotal, discount, and current status.
 * Owned by the calling agent (or any admin).
 */

interface Ctx { params: Promise<{ id: string }> }

function bad(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

export async function GET(_req: NextRequest, ctx: Ctx) {
  const gate = await requireAgent();
  if (!gate.ok) return gate.response;

  const { id } = await ctx.params;
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return bad('Invalid Coupon Id.');

  const svc = await createServiceClient();
  const { data: coupon } = await svc
    .from('coupons')
    .select('id, code, agent_id, discount_type, discount_value')
    .eq('id', id)
    .maybeSingle();
  if (!coupon) return bad('Coupon Not Found.', 404);

  if (coupon.agent_id !== gate.user.id) {
    const { data: caller } = await svc.from('profiles').select('role').eq('id', gate.user.id).maybeSingle();
    if (caller?.role !== 'admin') return bad('Forbidden.', 403);
  }

  const safeCouponCode = coupon.code.replace(/[\\%_[]/g, (c) => '\\' + c);
  const { data: orders, error } = await svc
    .from('orders')
    .select('id, buyer_id, subtotal, discount_amount, total, status, created_at, profiles!orders_buyer_id_fkey(full_name, username)')
    .eq('agent_id', coupon.agent_id)
    .ilike('coupon_code', safeCouponCode)
    .order('created_at', { ascending: false })
    .limit(500);

  if (error) {
    return bad('Failed To Load Redemptions.', 500);
  }

  const redemptions = (orders ?? []).map((o: any) => ({
    order_id: o.id as string,
    buyer_id: o.buyer_id as string,
    buyer_name: (o.profiles?.full_name as string | undefined) ?? (o.profiles?.username as string | undefined) ?? 'Researcher',
    subtotal: Number(o.subtotal) || 0,
    discount_amount: Number(o.discount_amount) || 0,
    total: Number(o.total) || 0,
    status: o.status as string,
    created_at: o.created_at as string,
  }));

  const totals = redemptions.reduce(
    (acc, r) => {
      if (r.status !== 'cancelled') {
        acc.count += 1;
        acc.discount_given += r.discount_amount;
        acc.revenue_driven += r.subtotal;
      }
      return acc;
    },
    { count: 0, discount_given: 0, revenue_driven: 0 },
  );

  return NextResponse.json({
    coupon: {
      id: coupon.id,
      code: coupon.code,
      discount_type: coupon.discount_type,
      discount_value: Number(coupon.discount_value) || 0,
    },
    redemptions,
    totals,
  });
}
