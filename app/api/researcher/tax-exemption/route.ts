import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';
import crypto from 'crypto';

const ALLOWED_MIME = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'application/pdf',
]);
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

const EXT_BY_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'application/pdf': 'pdf',
};

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const service = await createServiceClient();
  const { data, error } = await service
    .from('tax_exemptions')
    .select('id, state_code, organization_name, certificate_number, mime_type, size_bytes, uploaded_at, status, approved_at, rejected_reason, expires_at, storage_key')
    .eq('user_id', user.id)
    .order('uploaded_at', { ascending: false });

  if (error) return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });

  const enriched = await Promise.all(
    (data ?? []).map(async (row) => {
      const { data: signed } = await service.storage
        .from('tax-exemption-certs')
        .createSignedUrl(row.storage_key, 600);
      return { ...row, signed_url: signed?.signedUrl ?? null };
    })
  );

  return NextResponse.json({ data: enriched });
}

export async function POST(req: NextRequest) {
  void NextRequest;
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid Multipart Form Data.' }, { status: 400 });
  }

  const file = form.get('file');
  const stateRaw = form.get('state_code');
  const orgRaw = form.get('organization_name');
  const certNumRaw = form.get('certificate_number');
  const expiresRaw = form.get('expires_at');

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'A Certificate File Is Required.' }, { status: 400 });
  }
  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json({ error: 'Unsupported File Type. Use PNG, JPG, Or PDF.' }, { status: 400 });
  }
  if (file.size <= 0) {
    return NextResponse.json({ error: 'File Is Empty.' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'File Exceeds 5 MB Maximum.' }, { status: 400 });
  }

  const state_code = typeof stateRaw === 'string' ? stateRaw.trim().toUpperCase() : '';
  const organization_name = typeof orgRaw === 'string' ? orgRaw.trim() : '';
  const certificate_number = typeof certNumRaw === 'string' && certNumRaw.trim()
    ? certNumRaw.trim()
    : null;
  const expires_at = typeof expiresRaw === 'string' && expiresRaw.trim()
    ? expiresRaw.trim()
    : null;

  if (state_code.length !== 2) {
    return NextResponse.json({ error: 'A Valid Two-Letter State Code Is Required.' }, { status: 400 });
  }
  if (!organization_name) {
    return NextResponse.json({ error: 'Organization Name Is Required.' }, { status: 400 });
  }

  const service = await createServiceClient();
  const ext = EXT_BY_MIME[file.type] || 'bin';
  const key = `${user.id}/${crypto.randomUUID()}.${ext}`;
  const bytes = new Uint8Array(await file.arrayBuffer());

  const { error: uploadErr } = await service.storage
    .from('tax-exemption-certs')
    .upload(key, bytes, {
      contentType: file.type,
      upsert: false,
    });
  if (uploadErr) {
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }

  // Upsert by (user_id, state_code) — keep the latest submission. If a
  // previous storage_key existed, we leave the orphaned object (admin can
  // clean it up). Status is reset to pending so admin re-reviews.
  const { data: prior } = await service
    .from('tax_exemptions')
    .select('id, storage_key')
    .eq('user_id', user.id)
    .eq('state_code', state_code)
    .maybeSingle();

  const payload = {
    user_id: user.id,
    state_code,
    organization_name,
    certificate_number,
    storage_key: key,
    mime_type: file.type,
    size_bytes: file.size,
    status: 'pending',
    approved_by: null,
    approved_at: null,
    rejected_reason: null,
    expires_at,
    uploaded_at: new Date().toISOString(),
  };

  let row: { id: string } | null = null;
  if (prior?.id) {
    const { data, error } = await service
      .from('tax_exemptions')
      .update(payload)
      .eq('id', prior.id)
      .select('id')
      .single();
    if (error) {
      await service.storage.from('tax-exemption-certs').remove([key]).catch(() => {});
      return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
    }
    row = data;
    if (prior.storage_key && prior.storage_key !== key) {
      await service.storage.from('tax-exemption-certs').remove([prior.storage_key]).catch(() => {});
    }
  } else {
    const { data, error } = await service
      .from('tax_exemptions')
      .insert(payload)
      .select('id')
      .single();
    if (error) {
      await service.storage.from('tax-exemption-certs').remove([key]).catch(() => {});
      return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
    }
    row = data;
  }

  return NextResponse.json({ data: { id: row?.id, status: 'pending' } });
}
