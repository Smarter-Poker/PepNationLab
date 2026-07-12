import { z } from "zod";
/**
 * GET  /api/admin/shipping-origins  - list all shipping origins
 * POST /api/admin/shipping-origins  - create a new shipping origin
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';
import { validateAddress, type AddressInput } from '@/lib/shipping';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from('shipping_origins')
    .select('id, label, name, company, street1, street2, city, state, zip, country, phone, email, is_default, is_active, provider_address_id, created_at, updated_at')
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });

  const origins = data ?? [];
  const originIds = origins.map((o) => o.id);
  let agentAssignments: Array<{ id: string; display_name: string; slug: string; warehouse_origin_id: string }> = [];
  if (originIds.length > 0) {
    const { data: agents } = await supabase.from('agent_profiles').select('id, display_name, slug, warehouse_origin_id').in('warehouse_origin_id', originIds).eq('is_active', true);
    agentAssignments = (agents ?? []) as typeof agentAssignments;
  }

  const enriched = origins.map((o) => ({ ...o, assigned_agents: agentAssignments.filter((a) => a.warehouse_origin_id === o.id).map((a) => ({ id: a.id, display_name: a.display_name, slug: a.slug })) }));
  return NextResponse.json({ origins: enriched });
}


const POSTBodySchema = z.any();

export async function POST(req: NextRequest) {
  const csrfErr = assertSameOrigin(req);
  if (csrfErr) return csrfErr;

  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  
  
  const __rawBody = await req.json().catch(() => ({}));
  const __bodyParse = POSTBodySchema.safeParse(__rawBody);
  if (!__bodyParse.success) {
    return NextResponse.json({ error: "Invalid Request Body", details: __bodyParse.error.issues }, { status: 400 });
  }
  const body = __bodyParse.data;


  const label = typeof body.label === 'string' ? body.label.trim() : '';
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const street1 = typeof body.street1 === 'string' ? body.street1.trim() : '';
  const city = typeof body.city === 'string' ? body.city.trim() : '';
  const state = typeof body.state === 'string' ? body.state.trim() : '';
  const zip = typeof body.zip === 'string' ? body.zip.trim() : '';
  const country = typeof body.country === 'string' ? body.country.trim() : 'US';
  const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const company = typeof body.company === 'string' ? body.company.trim() : null;
  const street2 = typeof body.street2 === 'string' ? body.street2.trim() : null;
  const isDefault = body.is_default === true;

  if (!label || !name || !street1 || !city || !state || !zip || !phone || !email) {
    return NextResponse.json({ error: 'label, name, street1, city, state, zip, phone, And email Are Required.' }, { status: 400 });
  }

  const addrInput: AddressInput = { name, company: company ?? undefined, street1, street2: street2 ?? undefined, city, state, zip, country, phone, email };

  let providerAddressId: string | null = null;
  let validationWarning: string | null = null;

  try {
    const validation = await validateAddress(addrInput);
    if (!validation.isValid) return NextResponse.json({ error: 'Address Validation Failed.', messages: validation.messages, suggestion: validation.suggestion ?? null }, { status: 422 });
    providerAddressId = validation.providerAddressId ?? null;
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'EasyPost Unavailable';
    validationWarning = `Address Not Validated: ${msg}`;
  }

  const supabase = await createServiceClient();
  if (isDefault) await supabase.from('shipping_origins').update({ is_default: false }).eq('is_default', true);

  const { data: inserted, error: insertErr } = await supabase.from('shipping_origins').insert({ label, name, company: company || null, street1, street2: street2 || null, city, state, zip, country, phone, email, is_default: isDefault, is_active: true, provider_address_id: providerAddressId }).select().maybeSingle();
  if (insertErr || !inserted) return NextResponse.json({ error: 'A database error occurred.' }, { status: 500 });

  await supabase.from('admin_audit_log').insert({ actor_id: gate.userId, action: 'shipping_origin_create', entity_type: 'shipping_origins', entity_id: inserted.id, changes: { label, is_default: isDefault, provider_validated: !!providerAddressId } });
  return NextResponse.json({ ok: true, origin: inserted, warning: validationWarning }, { status: 201 });
}
