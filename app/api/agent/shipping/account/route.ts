/**
 * /api/agent/shipping/account - EasyPost Forge agent shipping account.
 *
 * GET  - safe status snapshot for the signed-in agent:
 *          { available, provisioned, billingStatus, cardBrand, cardLast4,
 *            keyLast4 }
 *        `available` is false while the admin Forge toggle is off (or no
 *        platform key is connected); the UI hides entirely in that case.
 *        NEVER returns ciphertext, decrypted keys, or any other secret.
 *
 * POST - provision the agent's white-label EasyPost sub-account (403 while
 *        Forge is disabled). Name/email come from the caller's profile
 *        (falling back to the storefront display name); phone from the body
 *        or the agent's warehouse address. Idempotent - an existing account
 *        is returned as-is. Body: { phone?: string }.
 *
 * Guards: assertSameOrigin (POST) -> requireAgent; service-role client for
 * all agent_shipping_accounts access (the table is RLS deny-all).
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAgent } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';
import { createAdminClient } from '@/lib/supabase/server';
import { isForgeEnabled, getAgentForgeStatus, provisionAgentAccount } from '@/lib/forge';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const gate = await requireAgent();
    if (!gate.ok) return gate.response;

    const admin = createAdminClient();
    const available = await isForgeEnabled(admin);
    if (!available) {
      return NextResponse.json({
        available: false,
        provisioned: false,
        billingStatus: null,
        cardBrand: null,
        cardLast4: null,
        keyLast4: null,
      });
    }

    const status = await getAgentForgeStatus(admin, gate.user.id);
    return NextResponse.json({
      available: true,
      provisioned: status.provisioned,
      billingStatus: status.billingStatus,
      cardBrand: status.cardBrand,
      cardLast4: status.cardLast4,
      keyLast4: status.keyLast4,
    });
  } catch (error) {
    console.error('Agent Shipping Account GET Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

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

    const body = await req.json().catch(() => ({} as { phone?: unknown }));
    const bodyPhone = typeof body?.phone === 'string' ? body.phone.trim() : '';

    const [{ data: profile }, { data: agentProfile }] = await Promise.all([
      admin
        .from('profiles')
        .select('full_name, email, contact_email')
        .eq('id', callerId)
        .maybeSingle(),
      admin
        .from('agent_profiles')
        .select('display_name, warehouse_address')
        .eq('id', callerId)
        .maybeSingle(),
    ]);

    const name =
      (profile?.full_name as string | null)?.trim() ||
      (agentProfile?.display_name as string | null)?.trim() ||
      '';
    const email =
      (profile?.contact_email as string | null)?.trim() ||
      (profile?.email as string | null)?.trim() ||
      '';

    const warehouse = (agentProfile?.warehouse_address || null) as Record<string, unknown> | null;
    const warehousePhone =
      warehouse && typeof warehouse.phone === 'string' ? warehouse.phone.trim() : '';
    const phone = bodyPhone || warehousePhone;

    if (!name) {
      return NextResponse.json(
        { error: 'A Display Name Is Required Before Creating A Shipping Account. Set One In Storefront Config.' },
        { status: 422 },
      );
    }
    if (!email || !email.includes('@')) {
      return NextResponse.json(
        { error: 'A Contact Email Is Required Before Creating A Shipping Account.' },
        { status: 422 },
      );
    }
    if (!phone) {
      return NextResponse.json(
        { error: 'A Phone Number Is Required. Add One To Your Warehouse Address Or Include It In The Request.' },
        { status: 422 },
      );
    }

    const result = await provisionAgentAccount(admin, { agentId: callerId, name, email, phone });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({
      ok: true,
      available: true,
      provisioned: result.account.provisioned,
      billingStatus: result.account.billingStatus,
      cardBrand: result.account.cardBrand,
      cardLast4: result.account.cardLast4,
      keyLast4: result.account.keyLast4,
    });
  } catch (error) {
    console.error('Agent Shipping Account POST Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
