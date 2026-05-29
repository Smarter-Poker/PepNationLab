import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';

export const dynamic = 'force-dynamic';

const ALLOWED_MIME = new Set([
  'image/png',
  'image/jpeg',
  'image/jpg',
  'application/pdf',
]);
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

const EXT_BY_MIME: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'application/pdf': 'pdf',
};

/**
 * POST /api/researcher/rma/[id]/upload
 * Multipart "file" — buyer uploads photo / PDF evidence for their RMA.
 * Stored privately under bucket "rma-attachments" with prefix "<rma_id>/".
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: 'Id Required' }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const service = await createServiceClient();

  // Confirm the requester actually owns this RMA before allowing upload.
  const { data: rma, error: rmaErr } = await service
    .from('rma_requests')
    .select('id, requester_id')
    .eq('id', id)
    .single();
  if (rmaErr || !rma) return NextResponse.json({ error: 'Not Found' }, { status: 404 });
  if (rma.requester_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid Multipart Form Data.' }, { status: 400 });
  }

  const file = form.get('file');
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'A File Is Required.' }, { status: 400 });
  }
  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json({ error: 'Unsupported File Type. Use PNG, JPG, Or PDF.' }, { status: 400 });
  }
  if (file.size <= 0) {
    return NextResponse.json({ error: 'File Is Empty.' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'File Exceeds 10 MB Maximum.' }, { status: 400 });
  }

  const ext = EXT_BY_MIME[file.type] || 'bin';
  const key = `${id}/${crypto.randomUUID()}.${ext}`;
  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);

  const { error: uploadErr } = await service.storage
    .from('rma-attachments')
    .upload(key, bytes, { contentType: file.type, upsert: false });
  if (uploadErr) {
    return NextResponse.json({ error: `Upload Failed: ${uploadErr.message}` }, { status: 500 });
  }

  const { data: row, error: insertErr } = await service
    .from('rma_attachments')
    .insert({
      rma_id: id,
      uploader_id: user.id,
      storage_key: key,
      mime_type: file.type,
      size_bytes: file.size,
    })
    .select('id, storage_key, mime_type, size_bytes, uploaded_at')
    .single();

  if (insertErr) {
    await service.storage.from('rma-attachments').remove([key]).catch(() => {});
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  const { data: signed } = await service.storage
    .from('rma-attachments')
    .createSignedUrl(key, 600);

  return NextResponse.json({ ok: true, attachment: { ...row, signed_url: signed?.signedUrl ?? null } });
}
