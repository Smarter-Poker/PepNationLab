/**
 * POST /api/admin/shipping-provider/forge
 *
 * Admin toggle for EasyPost Forge white-label shipping. While OFF (the
 * default), every agent-facing Forge surface is hidden and every Forge route
 * returns 403/404 - nothing user-visible changes. Flip it ON only after the
 * EasyPost partner (Forge/ReferralCustomer) approval lands.
 *
 * Body: { enabled: boolean }
 *
 * Guards: assertSameOrigin -> requireAdmin; writes admin_audit_log like the
 * other shipping-provider admin routes.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';
import { createServiceClient } from '@/lib/supabase/server';
import { invalidateActiveKeyCache } from '@/lib/shipping';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const csrfErr = assertSameOrigin(req);
  if (csrfErr) return csrfErr;

  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  let body: { enabled?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }
  if (typeof body.enabled !== 'boolean') {
    return NextResponse.json({ error: 'enabled Must Be A Boolean.' }, { status: 400 });
  }
  const enabled = body.enabled;

  const supabase = await createServiceClient();

  const { data: row } = await supabase
    .from('shipping_provider_credentials')
    .select('id, forge_enabled')
    .eq('provider', 'easypost')
    .eq('is_active', true)
    .maybeSingle();

  if (!row) {
    return NextResponse.json(
      { error: 'Connect EasyPost First. Forge Requires An Active Platform Credential.' },
      { status: 409 },
    );
  }

  const { error: updErr } = await supabase
    .from('shipping_provider_credentials')
    .update({ forge_enabled: enabled })
    .eq('id', row.id);
  if (updErr) {
    console.error('[shipping-provider/forge] update failed:', updErr.message);
    return NextResponse.json({ error: 'An Unexpected Error Occurred.' }, { status: 500 });
  }

  // Bust the in-process key cache so agent Forge keys stop/start resolving
  // immediately in this instance (the 60s TTL bounds any warm sibling).
  invalidateActiveKeyCache();

  await supabase.from('admin_audit_log').insert({
    actor_id: gate.userId,
    action: 'shipping_forge_toggle',
    entity_type: 'shipping_provider_credentials',
    entity_id: row.id,
    changes: { forge_enabled_from: !!row.forge_enabled, forge_enabled_to: enabled },
  });

  return NextResponse.json({ ok: true, forge_enabled: enabled });
}
