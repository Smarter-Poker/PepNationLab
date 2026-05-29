import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/admin-auth';
import { createServiceClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';

export async function GET() {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const service = await createServiceClient();
  const { data, error } = await service
    .from('tax_rules')
    .select('id, jurisdiction, state_code, base_rate, applies_to, shipping_taxable, is_active, notes, updated_at, updated_by')
    .order('state_code', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data: data ?? [] });
}

const PatchSchema = z.object({
  state_code: z.string().min(2).max(2),
  base_rate: z.number().min(0).max(0.5).optional(),
  applies_to: z.enum(['subtotal', 'subtotal_plus_shipping', 'shipping_only']).optional(),
  shipping_taxable: z.boolean().optional(),
  is_active: z.boolean().optional(),
  notes: z.string().optional().nullable(),
});

export async function PATCH(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Invalid Request Body.' }, { status: 400 }); }

  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid Tax Rule Payload.', details: parsed.error.issues }, { status: 400 });
  }

  const { state_code, ...patchRaw } = parsed.data;
  const stateCode = state_code.toUpperCase();
  const service = await createServiceClient();

  const { data: existing, error: fetchErr } = await service
    .from('tax_rules')
    .select('id, state_code, base_rate, applies_to, shipping_taxable, is_active, notes')
    .eq('state_code', stateCode)
    .maybeSingle();
  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  if (!existing) return NextResponse.json({ error: 'Tax Rule Not Found.' }, { status: 404 });

  const update: Record<string, unknown> = { updated_at: new Date().toISOString(), updated_by: gate.userId };
  if (patchRaw.base_rate !== undefined) update.base_rate = patchRaw.base_rate;
  if (patchRaw.applies_to !== undefined) update.applies_to = patchRaw.applies_to;
  if (patchRaw.shipping_taxable !== undefined) update.shipping_taxable = patchRaw.shipping_taxable;
  if (patchRaw.is_active !== undefined) update.is_active = patchRaw.is_active;
  if (patchRaw.notes !== undefined) update.notes = patchRaw.notes;

  const { error: updateErr } = await service
    .from('tax_rules')
    .update(update)
    .eq('state_code', stateCode);
  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  await service.from('admin_audit_log').insert({
    actor_id: gate.userId,
    action: 'tax_rule_update',
    entity_type: 'tax_rule',
    entity_id: existing.id,
    changes: {
      state_code: stateCode,
      before: {
        base_rate: existing.base_rate,
        applies_to: existing.applies_to,
        shipping_taxable: existing.shipping_taxable,
        is_active: existing.is_active,
        notes: existing.notes,
      },
      after: update,
    },
  }).then(() => {}, () => {});

  return NextResponse.json({ success: true });
}
