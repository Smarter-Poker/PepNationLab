import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

/**
 * Returns the real shipping rate from the DB for a given total weight.
 * Public endpoint — no auth required. The caller already knows their cart
 * weight; we only return the dollar amount the server will charge.
 *
 * Called by CheckoutForm to keep client preview in sync with server charges.
 * Falls back to $12.00 if no rate row matches (same fallback as orders API).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const weightOz = Number(body?.weightOz) || 0;

    if (weightOz < 0) {
      return NextResponse.json({ rate: 0 });
    }

    // Pickup orders always cost $0.
    if (body?.fulfillment === 'agent_pickup') {
      return NextResponse.json({ rate: 0 });
    }

    const supabase = await createServiceClient();
    const { data: rates } = await supabase
      .from('shipping_rates')
      .select('rate, min_weight_oz, max_weight_oz')
      .lte('min_weight_oz', weightOz)
      .gt('max_weight_oz', weightOz)
      .order('min_weight_oz', { ascending: false })
      .limit(1);

    const rate = rates && rates.length > 0 ? Number(rates[0].rate) : 12.00;
    return NextResponse.json({ rate });
  } catch (err) {
    console.error('[shipping-preview] error:', err);
    return NextResponse.json({ rate: 12.00 }); // safe fallback
  }
}
