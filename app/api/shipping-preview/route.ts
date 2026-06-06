import { NextRequest, NextResponse } from 'next/server';
import { assertSameOrigin } from '@/lib/csrf';
import { calculateShippingCost, ShippingOption } from '@/lib/shipping';

/**
 * Returns the weight-based shipping rate for a given total weight and shipping option.
 * Public endpoint - no auth required.
 *
 * Called by CheckoutForm to keep client preview in sync with server charges.
 */
export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  try {
    const body = await req.json().catch(() => ({}));
    const weightOz = Number(body?.weightOz) || 0;
    const shippingOption = (body?.shippingOption || (body?.fulfillment === 'agent_pickup' ? 'agent_pickup' : 'usps')) as ShippingOption;

    if (weightOz < 0) {
      return NextResponse.json({ rate: 0 });
    }

    const rate = calculateShippingCost(shippingOption, weightOz);
    return NextResponse.json({ rate });
  } catch (err) {
    console.error('[shipping-preview] error:', err);
    return NextResponse.json({ rate: 12.00 }); // safe fallback
  }
}
