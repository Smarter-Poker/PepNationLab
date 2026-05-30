/**
 * POST /api/agent/storefront-config/shippo-key/rotate
 *
 * LEGACY — decommissioned as part of Shippo Platform Account migration M1.
 * Per-agent Shippo keys are no longer used. All label purchasing goes through
 * the platform-account credentials managed at Admin → Settings → Shipping.
 *
 * Returns 410 Gone so callers (agent dashboards, legacy scripts) know the
 * endpoint is intentionally disabled, not just temporarily unavailable.
 */

import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    {
      error: 'This endpoint has been decommissioned.',
      migration: 'Shippo keys are now managed at Admin → Settings → Shipping → Account Connection.',
    },
    { status: 410 },
  );
}
