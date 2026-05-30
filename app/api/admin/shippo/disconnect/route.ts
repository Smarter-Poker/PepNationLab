/**
 * DELETE /api/admin/shippo/disconnect
 *
 * Deactivates the active platform_shippo_credentials row. Does NOT delete
 * the row — the ledger must remain intact. Simply sets is_active = false.
 *
 * Guards: admin role + recent MFA (5 min) + same-origin CSRF.
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdmin, assertMfaRecent } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';
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
    .from('platform_shippo_credentials')
    .select('id, mode, api_key_last4')
    .eq('is_active', true)
    .maybeSingle();

  if (!active) {
    return NextResponse.json(
      { error: 'No Active Shippo Connection Found.' },
      { status: 404 },
    );
  }

  const { error: updateErr } = await supabase
    .from('platform_shippo_credentials')
    .update({ is_active: false })
    .eq('id', active.id);

  if (updateErr) {
    return NextResponse.json(
      { error: `Database Error: ${updateErr.message}` },
      { status: 500 },
    );
  }

  await supabase.from('admin_audit_log').insert({
    actor_id: gate.userId,
    action: 'shippo_disconnect',
    entity_type: 'platform_shippo_credentials',
    entity_id: active.id,
    changes: { mode: active.mode, last4: active.api_key_last4 },
  });

  return NextResponse.json({ ok: true, disconnected_id: active.id });
}
