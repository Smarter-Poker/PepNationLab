import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { getEffectiveUser } from '@/lib/impersonation';
import { resolveCheckoutCoupon, getHouseAgentId } from '@/lib/coupons';
import { assertSameOrigin } from '@/lib/csrf';

/**
 * Validates a coupon code for the signed-in researcher at checkout.
 * Always returns HTTP 200 with a { valid, ... } body unless the caller
 * is unauthenticated. Order creation re-validates server-side.
 */
export async function POST(request: NextRequest) {
  const csrf = assertSameOrigin(request);
  if (csrf) return csrf;
  const supabase = await createClient();
  const { data: { user } } = await getEffectiveUser(supabase);

  if (!user) {
    return NextResponse.json(
      { valid: false, error: 'Please Sign In To Use A Coupon.' },
      { status: 401 }
    );
  }

  const body = await request.json().catch(() => ({}));
  // Normalize coupon code to match how orders/route.ts stores and redeems codes.
  const code = String(body.code ?? '').trim().toUpperCase();
  if (!code) {
    return NextResponse.json({ valid: false, error: 'Coupon Code Is Required.' });
  }
  // Validate subtotal is a non-negative finite number; a missing/invalid subtotal
  // could produce a false-positive if the coupon has a minimum-subtotal requirement.
  const rawSubtotal = Number(body.subtotal);
  if (!Number.isFinite(rawSubtotal) || rawSubtotal < 0) {
    return NextResponse.json({ valid: false, error: 'Invalid Cart Total.' });
  }
  const subtotal = rawSubtotal;

  const service = await createServiceClient();
  const { data: profile } = await service
    .from('profiles')
    .select('referring_agent_id')
    .eq('id', user.id)
    .maybeSingle();

  // Buyers with no referring agent (the admin's own account, legacy accounts)
  // fall back to the house storefront so house coupons still apply for them.
  const agentId = profile?.referring_agent_id ?? (await getHouseAgentId(service));

  // Resolves regular agent coupons AND platform signup promos (e.g. FIRST20),
  // which are translated into the buyer's personal first-order coupon.
  const result = await resolveCheckoutCoupon(service, {
    code,
    agentId,
    subtotal,
    userId: user.id,
  });

  return NextResponse.json(result);
}
