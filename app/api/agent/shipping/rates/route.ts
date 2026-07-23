/**
 * GET /api/agent/shipping/rates?orderId=...
 *
 * Live carrier rates for an order the agent is about to ship with their own
 * EasyPost Forge sub-account. Ownership (agent or parent super-agent),
 * ship-fulfillment, and approved_ship | in_fulfillment status are enforced
 * inside lib/shipping.quoteRatesForOrder; this route additionally requires
 * the Forge toggle to be on and the caller's billing to be active so rates
 * are always quoted on the account that will pay for the label.
 *
 * Response: { rates: [{rateId, carrier, serviceLevelToken, serviceLevelName,
 *             amountCents, estimatedDays}], parcelWeightOz, toCity, toState }
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAgent } from '@/lib/admin-auth';
import { createAdminClient } from '@/lib/supabase/server';
import { isForgeEnabled, getAgentForgeStatus } from '@/lib/forge';
import { quoteRatesForOrder } from '@/lib/shipping';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const gate = await requireAgent();
    if (!gate.ok) return gate.response;
    const callerId = gate.user.id;

    const orderId = req.nextUrl.searchParams.get('orderId')?.trim() || '';
    if (!orderId) {
      return NextResponse.json({ error: 'Order ID Required' }, { status: 400 });
    }

    const admin = createAdminClient();
    const available = await isForgeEnabled(admin);
    if (!available) {
      return NextResponse.json(
        { error: 'Shipping Accounts Are Not Enabled On This Platform Yet.' },
        { status: 403 },
      );
    }
    const account = await getAgentForgeStatus(admin, callerId);
    if (!account.provisioned || account.billingStatus !== 'active') {
      return NextResponse.json(
        { error: 'Set Up Your Shipping Account And Add A Card Before Buying Labels.' },
        { status: 403 },
      );
    }

    const quote = await quoteRatesForOrder({ orderId, agentId: callerId });
    if (!quote.ok) {
      return NextResponse.json({ error: quote.error, code: quote.code ?? null }, { status: quote.status });
    }

    return NextResponse.json({
      rates: quote.rates.map((r) => ({
        rateId: r.rateId,
        carrier: r.carrier,
        serviceLevelToken: r.serviceLevelToken,
        serviceLevelName: r.serviceLevelName,
        amountCents: r.amountCents,
        estimatedDays: r.estimatedDays ?? null,
      })),
      parcelWeightOz: quote.parcelWeightOz,
      toCity: quote.toCity,
      toState: quote.toState,
    });
  } catch (error) {
    console.error('Agent Shipping Rates API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
