
import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { requireAdmin } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface Params {
  params: Promise<{ id: string }>;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(s: string) {
  return UUID_RE.test(s);
}

function toDateOrNull(v: unknown): string | null {
  if (v === undefined || v === null || v === '') return null;
  const s = String(v).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  return s;
}

export async function GET(_req: NextRequest, { params }: Params) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const { id } = await params;
  if (!isUuid(id)) {
    return NextResponse.json({ error: 'Invalid Product Id.' }, { status: 400 });
  }

  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from('product_lots')
    .select('*')
    .eq('product_id', id)
    .order('received_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: 'Failed To Load Lots.' }, { status: 500 });
  }

  const lots = (data ?? []).map(row => ({
    ...row,
    coa_public_url: row.coa_storage_key
      ? supabase.storage.from('product-coas').getPublicUrl(row.coa_storage_key).data?.publicUrl ?? null
      : null,
  }));

  return NextResponse.json({ lots });
}

export async function POST(req: NextRequest, { params }: Params) {
  const csrfFail = assertSameOrigin(req);
  if (csrfFail) return csrfFail;

  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const { id } = await params;
  if (!isUuid(id)) {
    return NextResponse.json({ error: 'Invalid Product Id.' }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const lotNumber = String(body?.lot_number ?? '').trim();
  if (!lotNumber) {
    return NextResponse.json({ error: 'Lot Number Is Required.' }, { status: 400 });
  }
  if (lotNumber.length > 64) {
    return NextResponse.json({ error: 'Lot Number Too Long.' }, { status: 400 });
  }

  const supplier = body?.supplier ? String(body.supplier).trim().slice(0, 200) : null;
  const manufacturedAt = toDateOrNull(body?.manufactured_at);
  const expiresAt = toDateOrNull(body?.expires_at);
  const receivedAt = toDateOrNull(body?.received_at);
  const notes = body?.notes ? String(body.notes).trim().slice(0, 2000) : null;

  const supabase = await createServiceClient();

  // Verify the product exists
  const { data: product } = await supabase
    .from('products')
    .select('id')
    .eq('id', id)
    .maybeSingle();
  if (!product) {
    return NextResponse.json({ error: 'Product Not Found.' }, { status: 404 });
  }

  const insertRow: Record<string, unknown> = {
    product_id: id,
    lot_number: lotNumber,
    supplier,
    manufactured_at: manufacturedAt,
    expires_at: expiresAt,
    notes,
    created_by: gate.userId,
  };
  if (receivedAt) insertRow.received_at = receivedAt;

  const { data: lot, error } = await supabase
    .from('product_lots')
    .insert((insertRow) as any)
    .select('*')
    .maybeSingle();

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'A Lot With That Number Already Exists For This Product.' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed To Create Lot.' }, { status: 500 });
  }

  await supabase.from('admin_audit_log').insert({
    actor_id: gate.userId,
    action: 'product_lot_create',
    entity_type: 'product_lots',
    entity_id: lot.id, // @ts-ignore
    changes: { product_id: id, lot_number: lotNumber },
  });

  // product_lots feed the COA URLs embedded in the public storefront catalog
  // payload - purge the cached catalogs so the new lot's COA shows.
  try {
    revalidateTag('storefront-catalog', { expire: 0 });
  } catch { /* best-effort cache refresh */ }

  return NextResponse.json({ lot });
}
