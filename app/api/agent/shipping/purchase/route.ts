/**
 * POST /api/agent/shipping/purchase - RETIRED (HTTP 410).
 *
 * The platform no longer buys shipping labels for agents. Agents purchase
 * labels with their own carrier account (recommended tool: Pirate Ship) and
 * paste the tracking number back into the portal:
 *
 *   - Single order: POST /api/agent/orders/ship
 *   - Batch:        GET  /api/agent/shipping/export (Pirate Ship CSV out)
 *                   POST /api/agent/shipping/import-tracking (tracking CSV in)
 *
 * The platform EasyPost account is used ONLY to subscribe trackers for
 * buyer-facing tracking. Auth guards are kept so this endpoint leaks nothing
 * to unauthenticated callers.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAgent } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  try {
    const gate = await requireAgent();
    if (!gate.ok) return gate.response;

    return NextResponse.json(
      { error: 'Platform Label Purchasing Is Retired. Ship With Your Own Carrier Account And Paste The Tracking Number.' },
      { status: 410 },
    );
  } catch (error) {
    console.error('Agent Shipping Purchase API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
