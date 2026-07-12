import { z } from "zod";
import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { requireAdmin } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface Params {
  params: Promise<{ id: string; lotId: string }>;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(s: string) {
  return UUID_RE.test(s);
}

function toDateOrNull(v: unknown): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === '') return null;
  const s = String(v).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return undefined;
  return s;
}


const PATCHBodySchema = z.any();

export async function PATCH(req: NextRequest, { params }: Params) {
  const csrfFail = assertSameOrigin(req);
  if (csrfFail) return csrfFail;

  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const { id, lotId } = await params;
  if (!isUuid(id) || !isUuid(lotId)) {
    return NextResponse.json({ error: 'Invalid Id.' }, { status: 400 });
  }

  
  const __rawBody = await req.json().catch(() => ({}));
  const __bodyParse = PATCHBodySchema.safeParse(__rawBody);
  if (!__bodyParse.success) {
    return NextResponse.json({ error: "Invalid Request Body", details: __bodyParse.error.issues }, { status: 400 });
  }
  const body = __bodyParse.data;

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (typeof body?.lot_number === 'string') {
    const trimmed = body.lot_number.trim();
    if (!trimmed) return NextResponse.json({ error: 'Lot Number Cannot Be Empty.' }, { status: 400 });
    if (trimmed.length > 64) return NextResponse.json({ error: 'Lot Number Too Long.' }, { status: 400 });
    patch.lot_number = trimmed;
  }
  if ('supplier' in body) patch.supplier = body.supplier ? String(body.supplier).trim().slice(0, 200) : null;
  if ('notes' in body) patch.notes = body.notes ? String(body.notes).trim().slice(0, 2000) : null;
  if (typeof body?.is_active === 'boolean') patch.is_active = body.is_active;

  const manufactured = toDateOrNull(body?.manufactured_at);
  if (manufactured !== undefined) patch.manufactured_at = manufactured;
  const expires = toDateOrNull(body?.expires_at);
  if (expires !== undefined) patch.expires_at = expires;
  const received = toDateOrNull(body?.received_at);
  if (received !== undefined && received !== null) patch.received_at = received;

  const supabase = await createServiceClient();
  const { data: lot, error } = await supabase
    .from('product_lots')
    .update(patch)
    .eq('id', lotId)
    .eq('product_id', id)
    .select('*')
    .maybeSingle();

  if (error || !lot) {
    if (error?.code === '23505') {
      return NextResponse.json({ error: 'A Lot With That Number Already Exists For This Product.' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed To Update Lot.' }, { status: 500 });
  }

  await supabase.from('admin_audit_log').insert({
    actor_id: gate.userId,
    action: 'product_lot_update',
    entity_type: 'product_lots',
    entity_id: lot.id,
    changes: { product_id: id, fields: Object.keys(patch).filter(k => k !== 'updated_at') },
  });

  // Lot edits (is_active toggles especially) change which COA the public
  // storefront catalog surfaces - purge the cached catalogs.
  try {
    revalidateTag('storefront-catalog', { expire: 0 });
  } catch { /* best-effort cache refresh */ }

  return NextResponse.json({ lot });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const csrfFail = assertSameOrigin(req);
  if (csrfFail) return csrfFail;

  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const { id, lotId } = await params;
  if (!isUuid(id) || !isUuid(lotId)) {
    return NextResponse.json({ error: 'Invalid Id.' }, { status: 400 });
  }

  const supabase = await createServiceClient();

  const { data: existing } = await supabase
    .from('product_lots')
    .select('id, product_id, coa_storage_key, lot_number, coa_verified_at')
    .eq('id', lotId)
    .eq('product_id', id)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({ error: 'Lot Not Found.' }, { status: 404 });
  }

  // A verified certificate is undeletable (enforced by trg_coa_block_verified_delete).
  // This guard must come BEFORE the storage removal below: otherwise the signed
  // certificate file would be destroyed while the row it belongs to survives,
  // leaving a published COA pointing at nothing.
  if (existing.coa_verified_at) {
    return NextResponse.json(
      {
        error:
          'This Lot Has A Verified Certificate Of Analysis And Cannot Be Deleted. Deactivate It, Or Retract The Certificate.',
      },
      { status: 409 },
    );
  }

  if (existing.coa_storage_key) {
    await supabase.storage.from('product-coas').remove([existing.coa_storage_key]).catch(() => null);
  }

  const { error } = await supabase
    .from('product_lots')
    .delete()
    .eq('id', lotId)
    .eq('product_id', id);

  if (error) {
    return NextResponse.json({ error: 'Failed To Delete Lot.' }, { status: 500 });
  }

  await supabase.from('admin_audit_log').insert({
    actor_id: gate.userId,
    action: 'product_lot_delete',
    entity_type: 'product_lots',
    entity_id: lotId,
    changes: { product_id: id, lot_number: existing.lot_number },
  });

  // Deleting a lot removes its COA from the public storefront catalog -
  // purge the cached catalogs so a dead COA URL is not served.
  try {
    revalidateTag('storefront-catalog', { expire: 0 });
  } catch { /* best-effort cache refresh */ }

  return NextResponse.json({ ok: true });
}
