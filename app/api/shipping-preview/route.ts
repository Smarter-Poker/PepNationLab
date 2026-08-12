import { NextRequest, NextResponse } from 'next/server';
import { assertSameOrigin } from '@/lib/csrf';
import { calculateShippingCost, getShippingZone, getShippingZoneLabel, ShippingOption } from '@/lib/shipping-cost';

/**
 * Returns the shipping rate for a destination, matching exactly what checkout
 * will charge.
 *
 * Pep Nation fulfills every shipped order at a FLAT rate keyed on the
 * destination state ($20 midwest/inland, $25 coastal, $40 non-contiguous), so
 * this is a pure lookup -- no live carrier quoting, no weight tiers, and never
 * an "estimate" that differs from the charge. `estimated` stays in the payload
 * as `false` for backward compatibility with older clients that read it.
 *
 * Public endpoint - no auth required. Called by CheckoutForm.
 */
export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  try {
    const body = await req.json().catch(() => ({}));
    const shippingOption = (
      body?.shippingOption || (body?.fulfillment === 'agent_pickup' ? 'agent_pickup' : 'standard')
    ) as ShippingOption;

    if (shippingOption === 'agent_pickup') {
      return NextResponse.json({ rate: 0, estimated: false, zone: null, zoneLabel: 'Agent Pickup' });
    }

    // Destination state may arrive as a top-level field or inside the address
    // object the client sent under the previous live-quote payload shape.
    const state =
      (typeof body?.state === 'string' ? body.state : null) ??
      (typeof body?.to?.state === 'string' ? body.to.state : null);

    const zone = getShippingZone(state);
    const rate = calculateShippingCost(shippingOption, state);

    return NextResponse.json({
      rate,
      estimated: false,
      zone,
      zoneLabel: getShippingZoneLabel(zone),
      carrier: 'Pep Nation Standard Shipping',
    });
  } catch (err) {
    console.error('[shipping-preview] error:', err);
    // Destination unknown here (body unreadable): return the coastal rate, the
    // highest contiguous tier, so a preview never undercuts the real charge.
    return NextResponse.json({ rate: 25, estimated: false, zone: 'coastal' });
  }
}
