import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';
import { createServiceClient } from '@/lib/supabase/server';
import { sniffImageMime } from '@/lib/image-sniff';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface Params {
  params: Promise<{ id: string; lotId: string }>;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_BYTES = 10 * 1024 * 1024;
const MIME_TO_EXT: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

function isUuid(s: string) {
  return UUID_RE.test(s);
}

export async function POST(req: NextRequest, { params }: Params) {
  const csrfFail = assertSameOrigin(req);
  if (csrfFail) return csrfFail;

  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const { id, lotId } = await params;
  if (!isUuid(id) || !isUuid(lotId)) {
    return NextResponse.json({ error: 'Invalid Id.' }, { status: 400 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid Multipart Form Data.' }, { status: 400 });
  }

  const fileEntry = form.get('file');
  if (!(fileEntry instanceof File) || fileEntry.size === 0) {
    return NextResponse.json({ error: 'No File Provided.' }, { status: 400 });
  }

  if (!MIME_TO_EXT[fileEntry.type]) {
    return NextResponse.json(
      { error: 'Unsupported File Type. Use PDF, PNG, JPEG, Or WEBP.' },
      { status: 400 }
    );
  }
  if (fileEntry.size > MAX_BYTES) {
    return NextResponse.json({ error: 'File Exceeds 10 MB Maximum.' }, { status: 400 });
  }

  const supabase = await createServiceClient();

  const { data: existing } = await supabase
    .from('product_lots')
    .select('id, product_id, coa_storage_key, coa_verified_at, coa_retracted_at')
    .eq('id', lotId)
    .eq('product_id', id)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({ error: 'Lot Not Found.' }, { status: 404 });
  }

  // A published (verified, not-retracted) certificate's file is frozen. Its
  // bytes must not be silently replaced; require a retraction first.
  if (existing.coa_verified_at && !existing.coa_retracted_at) {
    return NextResponse.json(
      { error: 'This Certificate Is Published And Frozen. Retract It Before Replacing The File.' },
      { status: 409 }
    );
  }

  const bytes = new Uint8Array(await fileEntry.arrayBuffer());
  // Authoritative content sniff -- the client-declared MIME type can be spoofed.
  const isPdf =
    bytes.length >= 5 &&
    bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2d;
  const sniffedMime = isPdf ? 'application/pdf' : sniffImageMime(bytes);
  if (!sniffedMime || !MIME_TO_EXT[sniffedMime]) {
    return NextResponse.json(
      { error: 'File Content Does Not Match A Supported Type. Use PDF, PNG, JPEG, Or WEBP.' },
      { status: 400 }
    );
  }

  const ext = MIME_TO_EXT[sniffedMime];
  const storageKey = `${id}/${lotId}.${ext}`;

  // If there is an existing COA at a different key (different extension), drop it.
  if (existing.coa_storage_key && existing.coa_storage_key !== storageKey) {
    await supabase.storage.from('product-coas').remove([existing.coa_storage_key]).catch(() => null);
  }

  const { error: uploadErr } = await supabase.storage
    .from('product-coas')
    .upload(storageKey, bytes, {
      contentType: sniffedMime,
      upsert: true,
    });

  if (uploadErr) {
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }

  const nowIso = new Date().toISOString();
  const { data: lot, error: updateErr } = await supabase
    .from('product_lots')
    .update({
      coa_storage_key: storageKey,
      coa_mime_type: sniffedMime,
      coa_file_size: fileEntry.size,
      coa_uploaded_at: nowIso,
      coa_uploaded_by: gate.userId,
      updated_at: nowIso,
    })
    .eq('id', lotId)
    .eq('product_id', id)
    .select('*')
    .maybeSingle();

  if (updateErr || !lot) {
    return NextResponse.json({ error: 'Failed To Record COA Upload.' }, { status: 500 });
  }

  await supabase.from('admin_audit_log').insert({
    actor_id: gate.userId,
    action: 'product_lot_coa_upload',
    entity_type: 'product_lots',
    entity_id: lotId,
    changes: { product_id: id, storage_key: storageKey, mime: fileEntry.type, size: fileEntry.size },
  });

  const { data: publicData } = supabase.storage.from('product-coas').getPublicUrl(storageKey);

  return NextResponse.json({ lot, coa_public_url: publicData?.publicUrl ?? null });
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
    .select('id, product_id, coa_storage_key, coa_verified_at, coa_retracted_at')
    .eq('id', lotId)
    .eq('product_id', id)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({ error: 'Lot Not Found.' }, { status: 404 });
  }

  // A published (verified, not-retracted) certificate's file is frozen and
  // cannot be deleted; it must be retracted through the results route first.
  if (existing.coa_verified_at && !existing.coa_retracted_at) {
    return NextResponse.json(
      { error: 'This Certificate Is Published And Frozen. Retract It Before Removing The File.' },
      { status: 409 }
    );
  }

  if (existing.coa_storage_key) {
    await supabase.storage.from('product-coas').remove([existing.coa_storage_key]).catch(() => null);
  }

  const nowIso = new Date().toISOString();
  const { error: updateErr } = await supabase
    .from('product_lots')
    .update({
      coa_storage_key: null,
      coa_mime_type: null,
      coa_file_size: null,
      coa_uploaded_at: null,
      coa_uploaded_by: null,
      updated_at: nowIso,
    })
    .eq('id', lotId)
    .eq('product_id', id);

  if (updateErr) {
    return NextResponse.json({ error: 'Failed To Clear COA.' }, { status: 500 });
  }

  await supabase.from('admin_audit_log').insert({
    actor_id: gate.userId,
    action: 'product_lot_coa_delete',
    entity_type: 'product_lots',
    entity_id: lotId,
    changes: { product_id: id },
  });

  return NextResponse.json({ ok: true });
}
