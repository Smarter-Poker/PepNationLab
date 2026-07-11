import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { assertSameOrigin } from '@/lib/csrf';
import { calculateShippingCost, ShippingOption } from '@/lib/shipping-cost';
import { quoteCheapestForCheckout, normalizeShippingAddress } from '@/lib/shipping';
import { getSupabaseUrl } from '@/lib/supabase/url';

/**
 * Returns the shipping rate for a given weight/option, matching what checkout
 * will actually charge.
 *
 * When the caller supplies a complete destination address (and, optionally, the
 * agent slug to ship from), this quotes the live cheapest carrier rate via
 * EasyPost so the preview equals the charge. If no address is supplied,
 * EasyPost is slow/unavailable, or the destination returns no carrier rate, it falls back
 * to the weight-based flat estimate and flags `estimated: true` so the UI can
 * label it honestly rather than presenting an estimate as a firm live rate.
 *
 * Public endpoint - no auth required. Called by CheckoutForm.
 */
export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  try {
    const body = await req.json().catch(() => ({}));
    const weightOz = Number(body?.weightOz) || 0;
    const shippingOption = (body?.shippingOption || (body?.fulfillment === 'agent_pickup' ? 'agent_pickup' : 'usps')) as ShippingOption;

    if (weightOz < 0 || shippingOption === 'agent_pickup') {
      return NextResponse.json({ rate: 0, estimated: false });
    }

    const flat = calculateShippingCost(shippingOption, weightOz);

    // Attempt a live carrier quote when we have a real destination to ship to.
    const to = normalizeShippingAddress(body?.to || null);
    if (to) {
      try {
        let agentId: string | null = null;
        const agentSlug = typeof body?.agentSlug === 'string' ? body.agentSlug.trim() : '';
        if (agentSlug) {
          const url = getSupabaseUrl();
          const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
          if (url && key) {
            const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
            const { data } = await admin
              .from('agent_profiles')
              .select('id')
              .eq('slug', agentSlug)
              .maybeSingle();
            agentId = (data?.id as string | undefined) ?? null;
          }
        }
        const totalQty = Number(body?.totalQty) || 1;
        const live = await quoteCheapestForCheckout({ agentId, to, weightOz, totalQty });
        if (live && live.amountCents > 0) {
          return NextResponse.json({
            rate: Math.round(live.amountCents) / 100,
            estimated: false,
            carrier: live.carrier,
            serviceLevel: live.serviceLevelName,
          });
        }
      } catch (err) {
        console.error('[shipping-preview] live quote failed; using flat estimate:', err);
      }
    }

    return NextResponse.json({ rate: flat, estimated: true });
  } catch (err) {
    console.error('[shipping-preview] error:', err);
    // Weight is unknown here (body unreadable); return the base flat rate rather
    // than a fixed $12 that would mismatch the weight-based server charge.
    return NextResponse.json({ rate: 40, estimated: true });
  }
}
