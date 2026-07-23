/**
 * POST /api/agent/shipping/account/card
 *
 * Attach the agent's card to their EasyPost Forge sub-account. The browser
 * tokenizes the card with Stripe.js (using EasyPost's Stripe publishable key
 * from ../stripe-key) and sends only the resulting reference here - the raw
 * card number never touches our servers.
 *
 * Body: {
 *   paymentMethodReference: string,   // Stripe payment method / token id
 *   stripeCustomerId?: string         // present only in the SetupIntent flow
 * }
 *
 * Server side this calls EasyPost WITH THE AGENT'S referral key:
 *   - POST /v2/credit_cards {credit_card: {payment_method_id, priority}}
 *   - or POST /beta/referral_customers/payment_method when a
 *     stripe_customer_id is supplied.
 * On success billing_status flips to 'active' with the card brand/last4.
 *
 * Guards: assertSameOrigin -> requireAgent; forge toggle; service client.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAgent } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';
import { createAdminClient } from '@/lib/supabase/server';
import { isForgeEnabled, getAgentForgeStatus, addAgentCard } from '@/lib/forge';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  try {
    const gate = await requireAgent();
    if (!gate.ok) return gate.response;
    const callerId = gate.user.id;

    const admin = createAdminClient();
    const available = await isForgeEnabled(admin);
    if (!available) {
      return NextResponse.json(
        { error: 'Shipping Accounts Are Not Enabled On This Platform Yet.' },
        { status: 403 },
      );
    }

    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const paymentMethodReference =
      typeof body?.paymentMethodReference === 'string' ? body.paymentMethodReference.trim() : '';
    const stripeCustomerId =
      typeof body?.stripeCustomerId === 'string' && body.stripeCustomerId.trim()
        ? body.stripeCustomerId.trim()
        : null;

    if (!paymentMethodReference) {
      return NextResponse.json({ error: 'Payment Method Reference Is Required.' }, { status: 400 });
    }

    const result = await addAgentCard(admin, callerId, {
      paymentMethodReference,
      stripeCustomerId,
      priority: 'primary',
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    const status = await getAgentForgeStatus(admin, callerId);
    return NextResponse.json({
      ok: true,
      available: true,
      provisioned: status.provisioned,
      billingStatus: status.billingStatus,
      cardBrand: status.cardBrand,
      cardLast4: status.cardLast4,
      keyLast4: status.keyLast4,
    });
  } catch (error) {
    console.error('Agent Shipping Card POST Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
