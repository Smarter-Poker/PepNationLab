/**
 * POST /api/agent/storefront-config/shippo-key
 *
 * DEPRECATED - This endpoint is now a no-op stub.
 *
 * PepNationLab migrated to a Platform Shippo Account in M1 (2026-06-01).
 * Per-agent Shippo API keys are no longer used - all labels are purchased
 * through the single platform account key stored in
 * `platform_shippo_credentials`. The admin connects and rotates that key
 * from Settings → Shipping → Account Connection.
 *
 * The GET still returns a deprecation notice so the Storefront Config UI
 * can display an informational message instead of a dead "Show Key" control.
 */

import { NextResponse } from 'next/server';
import { requireAgentOrAdmin } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';

export async function GET() {
  const gate = await requireAgentOrAdmin();
  if (!gate.ok) return gate.response;

  return NextResponse.json({
    deprecated: true,
    message: 'Per-Agent Shippo API Keys Are No Longer Required. PepNationLab Now Uses A Platform Shippo Account For All Label Purchases. Contact Your Admin For Details.',
    shippo_api_key: null,
  });
}

export async function POST() {
  return NextResponse.json(
    {
      deprecated: true,
      error: 'Per-Agent Shippo Keys Are No Longer Required. All Labels Are Purchased Through The Platform Account.',
    },
    { status: 410 },
  );
}
