/**
 * DELETE /api/admin/shipping-provider/disconnect
 *
 * Deactivates the active shipping_provider_credentials row. Does NOT delete
 * the row - the ledger must remain intact. Simply sets is_active = false.
 *
 * Guards: admin role + recent MFA (5 min) + same-origin CSRF.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdmin, assertMfaRecent } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';
import { invalidateActiveKeyCache } from '@/lib/shipping';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function DELETE(req: NextRequest) {
  const csrfErr = assertSameOrigin(req);
  if (csrfErr) return csrfErr;

  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const mfaErr = await assertMfaRecent(req, 5 * 60 * 1000);
  if (mfaErr) return mfaErr;

  const supabase = await createServiceClient();

  const { data: active } = await supabase
    .from('shipping_provider_credentials')
    .select('id, mode, api_key_last4')
    .eq('provider', 'easypost')
    .eq('is_active', true)
    .maybeSingle();

  if (!active) {
    return NextResponse.json(
      { error: 'No Active EasyPost Connection Found.' },
      { status: 404 },
    );
  }

  const { error: updateErr } = await supabase
    .from('shipping_provider_credentials')
    .update({ is_active: false })
    .eq('id', active.id);

  if (updateErr) {
    console.error('Shipping provider disconnect update failed:', updateErr.message);
    return NextResponse.json(
      { error: 'An unexpected error occurred.' },
      { status: 500 },
    );
  }

  invalidateActiveKeyCache();

  await supabase.from('admin_audit_log').insert({
    actor_id: gate.userId,
    action: 'shipping_provider_disconnect',
    entity_type: 'shipping_provider_credentials',
    entity_id: active.id,
    changes: { provider: 'easypost', mode: active.mode, last4: active.api_key_last4 },
  });

  return NextResponse.json({ ok: true, disconnected_id: active.id });
}
