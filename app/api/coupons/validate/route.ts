import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { validateCoupon } from '@/lib/coupons';

/**
 * Validates a coupon code for the signed-in researcher at checkout.
 * Always returns HTTP 200 with a { valid, ... } body unless the caller
 * is unauthenticated. Order creation re-validates server-side.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { valid: false, error: 'Please Sign In To Use A Coupon.' },
      { status: 401 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const code = String(body.code ?? '');
  const subtotal = Number(body.subtotal) || 0;

  const service = await createServiceClient();
  const { data: profile } = await service
    .from('profiles')
    .select('referring_agent_id')
    .eq('id', user.id)
    .single();

  const result = await validateCoupon(service, {
    code,
    agentId: profile?.referring_agent_id ?? null,
    subtotal,
  });

  return NextResponse.json(result);
}
