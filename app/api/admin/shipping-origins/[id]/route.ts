/**
 * PATCH  /api/admin/shipping-origins/[id]  - update a shipping origin
 * DELETE /api/admin/shipping-origins/[id]  - soft-delete (is_active=false)
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';
import { validateAddress, type AddressInput } from '@/lib/shippo';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface RouteParams { params: Promise<{ id: string }>; }

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  const csrfErr = assertSameOrigin(req);
  if (csrfErr) return csrfErr;

  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const { id } = await params;
  const supabase = await createServiceClient();

  const { data: existing, error: fetchErr } = await supabase.from('shipping_origins').select('*').eq('id', id).maybeSingle();
  if (fetchErr || !existing) return NextResponse.json({ error: 'Shipping Origin Not Found.' }, { status: 404 });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 }); }

  const updates: Record<string, unknown> = {};
  const stringFields = ['label', 'name', 'company', 'street1', 'street2', 'city', 'state', 'zip', 'country', 'phone', 'email'] as const;
  for (const f of stringFields) { if (f in body) updates[f] = typeof body[f] === 'string' ? (body[f] as string).trim() || null : null; }
  if ('is_active' in body && typeof body.is_active === 'boolean') updates.is_active = body.is_active;
  if ('is_default' in body && typeof body.is_default === 'boolean') updates.is_default = body.is_default;
  if (Object.keys(updates).length === 0) return NextResponse.json({ error: 'No Updateable Fields Provided.' }, { status: 400 });

  const requiredFields = ['label', 'name', 'street1', 'city', 'state', 'zip', 'phone', 'email'] as const;
  for (const f of requiredFields) { if (f in updates && (updates[f] === null || updates[f] === '')) return NextResponse.json({ error: `Field '${f}' Is Required And Cannot Be Cleared.` }, { status: 400 }); }

  const addrChanged = ['street1', 'city', 'state', 'zip'].some((f) => f in updates);
  if (addrChanged) {
    const addrInput: AddressInput = { name: String(updates.name ?? existing.name ?? ''), street1: String(updates.street1 ?? existing.street1), city: String(updates.city ?? existing.city), state: String(updates.state ?? existing.state), zip: String(updates.zip ?? existing.zip), country: String(updates.country ?? existing.country ?? 'US') };
    try {
      const validation = await validateAddress(addrInput);
      if (!validation.isValid) return NextResponse.json({ error: 'Address Validation Failed.', messages: validation.messages, suggestion: validation.suggestion ?? null }, { status: 422 });
      updates.shippo_address_id = validation.shippoAddressId ?? null;
    } catch { /* Shippo unavailable - proceed without re-validating */ }
  }

  if (updates.is_default === true) await supabase.from('shipping_origins').update({ is_default: false }).eq('is_default', true).neq('id', id);

  const { data: updated, error: updateErr } = await supabase.from('shipping_origins').update(updates).eq('id', id).select().single();
  if (updateErr || !updated) return NextResponse.json({ error: 'A database error occurred.' }, { status: 500 });

  await supabase.from('admin_audit_log').insert({ actor_id: gate.userId, action: 'shipping_origin_update', entity_type: 'shipping_origins', entity_id: id, changes: { fields_changed: Object.keys(updates) } });
  return NextResponse.json({ ok: true, origin: updated });
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const csrfErr = assertSameOrigin(req);
  if (csrfErr) return csrfErr;

  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const { id } = await params;
  const supabase = await createServiceClient();

  const { data: existing } = await supabase.from('shipping_origins').select('id, label, is_default, is_active').eq('id', id).maybeSingle();
  if (!existing) return NextResponse.json({ error: 'Shipping Origin Not Found.' }, { status: 404 });
  if (existing.is_default) return NextResponse.json({ error: 'Cannot Deactivate The Default Shipping Origin. Set Another Origin As Default First.' }, { status: 409 });

  const { error: updateErr } = await supabase.from('shipping_origins').update({ is_active: false }).eq('id', id);
  if (updateErr) return NextResponse.json({ error: 'A database error occurred.' }, { status: 500 });

  await supabase.from('admin_audit_log').insert({ actor_id: gate.userId, action: 'shipping_origin_deactivate', entity_type: 'shipping_origins', entity_id: id, changes: { label: existing.label } });
  return NextResponse.json({ ok: true, deactivated_id: id });
}
