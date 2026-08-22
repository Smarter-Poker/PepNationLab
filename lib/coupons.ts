import type { createServiceClient } from '@/lib/supabase/server';
import { DEFAULT_STORE_SLUG } from '@/lib/default-store';

type ServiceClient = Awaited<ReturnType<typeof createServiceClient>>;

export interface CouponValidation {
  valid: boolean;
  error?: string;
  couponId?: string;
  code?: string;
  discountType?: 'percent' | 'fixed';
  discountValue?: number;
  discount?: number;
  /** True when the entered code was a signup promo translated to a personal coupon. */
  promoTranslated?: boolean;
  promoLabel?: string;
}

const NOT_FOUND_ERROR = 'That Coupon Code Is Not Valid.';

export function normalizeCouponCode(code: string): string {
  return (code || '').trim().toUpperCase();
}

/**
 * Resolve the house storefront's agent id (the Pep Nation Research Store).
 * Buyers with no referring agent -- the admin's own account, or any account
 * created before house-store auto-linking -- fall back to this so house
 * coupons still work for them.
 */
export async function getHouseAgentId(supabase: ServiceClient): Promise<string | null> {
  const { data } = await supabase
    .from('agent_profiles')
    .select('id')
    .eq('slug', DEFAULT_STORE_SLUG)
    .eq('is_active', true)
    .maybeSingle();
  return data?.id ?? null;
}

export async function validateCoupon(
  supabase: ServiceClient,
  opts: { code: string; agentId: string | null; subtotal: number; userId?: string | null }
): Promise<CouponValidation> {
  const code = normalizeCouponCode(opts.code);
  if (!code) return { valid: false, error: 'Enter A Coupon Code.' };
  if (!opts.agentId) return { valid: false, error: 'Coupon Codes Are Only Valid For Orders Placed Through A Referring Agent.' };

  const { data: coupon, error } = await supabase
    .from('coupons')
    .select('id, code, agent_id, discount_type, discount_value, min_order_amount, max_uses, max_uses_per_user, uses_count, starts_at, expires_at, new_customers_only, is_active')
    .eq('agent_id', opts.agentId)
    .eq('code', code)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) {
    return { valid: false, error: 'Could Not Verify Coupon.' };
  }
  if (!coupon) {
    return { valid: false, error: NOT_FOUND_ERROR };
  }
  if (!coupon.is_active) {
    return { valid: false, error: 'That Coupon Is No Longer Active.' };
  }
  if (coupon.starts_at && new Date(coupon.starts_at).getTime() > Date.now()) {
    return { valid: false, error: 'That Coupon Is Not Active Yet.' };
  }
  if (coupon.expires_at && new Date(coupon.expires_at).getTime() < Date.now()) {
    return { valid: false, error: 'That Coupon Has Expired.' };
  }
  if (coupon.max_uses != null && Number(coupon.uses_count) >= Number(coupon.max_uses)) {
    return { valid: false, error: 'That Coupon Has Reached Its Usage Limit.' };
  }
  if (
    coupon.min_order_amount != null &&
    opts.subtotal < Number(coupon.min_order_amount)
  ) {
    return {
      valid: false,
      error: `A Minimum Order Of $${Number(coupon.min_order_amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Is Required For This Coupon.`,
    };
  }

  // First-order-only coupons: mirror redeem_coupon's check here so the buyer
  // gets an accurate message at apply time instead of a late order failure.
  if (coupon.new_customers_only && opts.userId) {
    const { count } = await supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('buyer_id', opts.userId)
      .neq('status', 'cancelled');
    if (count != null && count > 0) {
      return { valid: false, error: 'That Coupon Is For First-Time Customers Only.' };
    }
  }

  // Check per-user usage limit
  if (coupon.max_uses_per_user != null && opts.userId) {
    const { count } = await supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('coupon_code', coupon.code)
      .eq('buyer_id', opts.userId)
      .neq('status', 'cancelled');
    if (count != null && count >= Number(coupon.max_uses_per_user)) {
      return { valid: false, error: 'You Have Already Used This Coupon The Maximum Number Of Times.' };
    }
  }

  const discountValue = Number(coupon.discount_value);
  let discount = coupon.discount_type === 'percent' ? opts.subtotal * (discountValue / 100) : discountValue;
  discount = Math.max(0, discount);      // guard against negative discount_value in DB (would inflate total)
  discount = Math.min(discount, opts.subtotal);
  discount = Math.round(discount * 100) / 100;

  return { valid: true, couponId: coupon.id, code: coupon.code, discountType: coupon.discount_type, discountValue, discount };
}

/**
 * Checkout-facing resolution: first try the code as a regular agent coupon;
 * if it doesn't exist, try it as a signup promo (e.g. FIRST20).
 *
 * Promo codes are UNIVERSAL: redeemable at signup or at checkout. A
 * first-order-coupon promo entered at checkout is redeemed on the spot
 * (one per account, enforced by redeem_signup_promo), which mints the
 * buyer's personal WELCOME-XXXX coupon, and THAT coupon is applied.
 * Re-entering the promo code later resolves back to the same personal
 * coupon. A store-credit promo entered at checkout is also redeemed on the
 * spot -- the credit lands on the account wallet and the shopper is told so.
 *
 * The returned `code` is the coupon actually applied (may differ from the
 * entered promo code) -- callers must use it for redeem_coupon and order rows.
 */
export async function resolveCheckoutCoupon(
  supabase: ServiceClient,
  opts: { code: string; agentId: string | null; subtotal: number; userId: string }
): Promise<CouponValidation> {
  const code = normalizeCouponCode(opts.code);
  const direct = await validateCoupon(supabase, { ...opts, code });
  // Only fall through to the promo path when the code simply doesn't exist as
  // a coupon; every other failure (expired, limit, minimum) is a real answer.
  if (direct.valid || direct.error !== NOT_FOUND_ERROR) return direct;

  const { data: promo } = await supabase
    .from('signup_promo_codes')
    .select('id, code, name, reward_key')
    .eq('code', code)
    .maybeSingle();
  if (!promo) return direct;

  const { data: cat } = await supabase
    .from('signup_promo_reward_catalog')
    .select('grant_kind, label')
    .eq('key', promo.reward_key)
    .maybeSingle();

  // One signup promo per account (redeem_signup_promo enforces this). If this
  // account already redeemed one that granted a coupon, apply that coupon.
  const { data: redemption } = await supabase
    .from('signup_promo_redemptions')
    .select('id, coupon_code')
    .eq('user_id', opts.userId)
    .limit(1)
    .maybeSingle();

  if (redemption) {
    if (redemption.coupon_code) {
      const granted = await validateCoupon(supabase, { ...opts, code: redemption.coupon_code });
      return { ...granted, promoTranslated: true, promoLabel: cat?.label ?? undefined };
    }
    return { valid: false, error: 'A Signup Promo Has Already Been Applied To This Account.' };
  }

  if (cat?.grant_kind !== 'first_order_coupon' && cat?.grant_kind !== 'store_credit') {
    return { valid: false, error: NOT_FOUND_ERROR };
  }

  // Promo codes are universal: redeemable at signup OR at checkout.
  // Redeeming here grants the reward on the spot -- a personal first-order
  // coupon, or store credit added to the account's wallet.
  const { data: out, error: promoErr } = await supabase.rpc('redeem_signup_promo', {
    p_user_id: opts.userId,
    p_code: code,
  });
  if (promoErr) {
    return { valid: false, error: promoErr.message || NOT_FOUND_ERROR };
  }

  if (cat.grant_kind === 'store_credit') {
    const credit = Number((out as { reward_value?: unknown } | null)?.reward_value) || 0;
    return {
      valid: false,
      error: `Promo Redeemed: $${credit.toFixed(2)} Store Credit Was Added To Your Account Balance. Store Credit Applies To Your Balance Rather Than This Order's Total.`,
    };
  }

  const grantedCode = (out as { coupon_code?: string } | null)?.coupon_code;
  if (!grantedCode) return { valid: false, error: NOT_FOUND_ERROR };

  const granted = await validateCoupon(supabase, { ...opts, code: grantedCode });
  return { ...granted, promoTranslated: true, promoLabel: cat?.label ?? undefined };
}
