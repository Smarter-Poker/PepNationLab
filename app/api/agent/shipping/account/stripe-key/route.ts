/**
 * GET /api/agent/shipping/account/stripe-key
 *
 * Returns EasyPost's Stripe PUBLISHABLE key so the browser can tokenize the
 * agent's card with Stripe.js before the payment method reference is sent to
 * /api/agent/shipping/account/card. Publishable keys are safe to expose to
 * the client by design; no secret key is ever involved here.
 *
 * Resolution mirrors the official easypost-node lib:
 *   GET /v2/partners/stripe_public_key (platform key) -> {public_key},
 * with the EASYPOST_STRIPE_PUBLISHABLE_KEY env var as fallback.
 *
 * 404 while the admin Forge toggle is off, so nothing leaks pre-launch.
 */

import { NextResponse } from 'next/server';
import { requireAgent } from '@/lib/admin-auth';
import { createAdminClient } from '@/lib/supabase/server';
import { isForgeEnabled, getEasyPostStripeKey } from '@/lib/forge';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const gate = await requireAgent();
    if (!gate.ok) return gate.response;

    const admin = createAdminClient();
    const available = await isForgeEnabled(admin);
    if (!available) {
      return NextResponse.json({ error: 'Not Found' }, { status: 404 });
    }

    const publishableKey = await getEasyPostStripeKey();
    if (!publishableKey) {
      return NextResponse.json(
        { error: 'Card Setup Is Temporarily Unavailable. Please Try Again Later.' },
        { status: 503 },
      );
    }

    return NextResponse.json({ publishableKey });
  } catch (error) {
    console.error('Agent Shipping Stripe Key Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
