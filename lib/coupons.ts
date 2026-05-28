import type { createServiceClient } from '@/lib/supabase/server';

type ServiceClient = Awaited<ReturnType<typeof createServiceClient>>;

export interface CouponValidation {
  valid: boolean;
  error?: string;
  couponId?: string;
  code?: string;
  discountType?: 'percent' | 'fixed';
  discountValue?: number;
  discount?: number;
}

export function normalizeCouponCode(code: string): string {
  return (code || '').trim().toUpperCase();
}

export async function validateCoupon(
  supabase: ServiceClient,
  opts: { code: string; agentId: string | null; subtotal: number }
): Promise<CouponValidation> {
  const code = normalizeCouponCode(opts.code);
  if (!code) return { valid: false, error: 'Enter A Coupon Code.' };
  if (!opts.agentId) return { valid: false, error: 'Coupon Codes Are Only Valid For Orders Placed Through A Referring Agent.' };

  const { data: coupon, error } = await supabase
    .from('coupons')
    .select('id, code, agent_id, discount_type, discount_value, min_order_amount, max_uses, uses_count, expires_at, is_active')
    .eq('agent_id', opts.agentId)
    .eq('code', code)
    .maybeSingle();

  if (error) return { valid: false, error: 'Could Not Verify Coupon.' };
  if (!coupon) return { valid: false, error: 'That Coupon Code Is Not Valid.' };
  if (!coupon.is_active) return { valid: false, error: 'That Coupon Is No Longer Active.' };
  if (coupon.expires_at && new Date(coupon.expires_at).getTime() < Date.now()) return { valid: false, error: 'That Coupon Has Expired.' };
  if (coupon.max_uses != null && Number(coupon.uses_count) >= Number(coupon.max_uses)) return { valid: false, error: 'That Coupon Has Reached Its Usage Limit.' };
  if (coupon.min_order_amount != null && opts.subtotal < Number(coupon.min_order_amount)) {
    return { valid: false, error: `A Minimum Order Of $${Math.ceil(Number(coupon.min_order_amount))} Is Required For This Coupon.` };
  }

  const discountValue = Number(coupon.discount_value);
  let discount = coupon.discount_type === 'percent' ? opts.subtotal * (discountValue / 100) : discountValue;
  discount = Math.min(discount, opts.subtotal);
  discount = Math.round(discount * 100) / 100;

  return { valid: true, couponId: coupon.id, code: coupon.code, discountType: coupon.discount_type, discountValue, discount };
}
