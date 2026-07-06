import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAX_FILES = 50;
const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

interface UploadedResult {
  file: string;
  product_id: string;
  matched_by: 'slug' | 'sku';
  public_url: string;
}

interface SkippedResult {
  file: string;
  reason: string;
}

export async function POST(req: NextRequest) {
  const csrfFail = assertSameOrigin(req);
  if (csrfFail) return csrfFail;

  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Invalid Multipart Form Data.' }, { status: 400 });
  }

  const filesRaw = [
    ...form.getAll('files[]'),
    ...form.getAll('files'),
    ...form.getAll('file'),
  ];

  const files = filesRaw.filter((f): f is File => f instanceof File && f.size > 0);

  if (files.length === 0) {
    return NextResponse.json({ error: 'No Files Provided.' }, { status: 400 });
  }
  if (files.length > MAX_FILES) {
    return NextResponse.json(
      { error: `Too Many Files. Max ${MAX_FILES} Per Request.` },
      { status: 400 }
    );
  }

  const supabase = await createServiceClient();

  const uploaded: UploadedResult[] = [];
  const skipped: SkippedResult[] = [];
  const updatedProductIds: string[] = [];

  for (const file of files) {
    const fileName = file.name || 'unknown';

    if (!ALLOWED_MIME.has(file.type)) {
      skipped.push({ file: fileName, reason: 'Unsupported File Type. Use JPEG, PNG, Or WEBP.' });
      continue;
    }
    if (file.size > MAX_BYTES) {
      skipped.push({ file: fileName, reason: 'File Exceeds 5 MB Maximum.' });
      continue;
    }

    const lastDot = fileName.lastIndexOf('.');
    const baseRaw = lastDot > 0 ? fileName.substring(0, lastDot) : fileName;
    const baseSlug = slugify(baseRaw);

    if (!baseSlug) {
      skipped.push({ file: fileName, reason: 'Could Not Derive Lookup Key From Filename.' });
      continue;
    }

    let productId: string | null = null;
    let matchedBy: 'slug' | 'sku' = 'slug';

    const { data: bySlug } = await supabase
      .from('products')
      .select('id, slug')
      .eq('slug', baseSlug)
      .maybeSingle();

    if (bySlug?.id) {
      productId = bySlug.id;
      matchedBy = 'slug';
    } else {
      const safeSku = baseRaw.trim().replace(/[\\%_[]/g, (c) => '\\' + c);
      const { data: bySku } = await supabase
        .from('products')
        .select('id, sku')
        .ilike('sku', safeSku)
        .maybeSingle();
      if (bySku?.id) {
        productId = bySku.id;
        matchedBy = 'sku';
      }
    }

    if (!productId) {
      skipped.push({
        file: fileName,
        reason: `No Product Found Matching slug Or sku "${baseSlug}".`,
      });
      continue;
    }

    const ext = MIME_TO_EXT[file.type];
    const storagePath = `${baseSlug}.${ext}`;

    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    const { error: uploadErr } = await supabase.storage
      .from('product-images')
      .upload(storagePath, bytes, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadErr) {
      skipped.push({ file: fileName, reason: 'Upload Failed.' });
      continue;
    }

    const { data: publicData } = supabase.storage
      .from('product-images')
      .getPublicUrl(storagePath);

    const publicUrl = publicData?.publicUrl;
    if (!publicUrl) {
      skipped.push({ file: fileName, reason: 'Could Not Resolve Public URL.' });
      continue;
    }

    const { error: updateErr } = await supabase
      .from('products')
      .update({ image_url: publicUrl, updated_at: new Date().toISOString() })
      .eq('id', productId);

    if (updateErr) {
      skipped.push({ file: fileName, reason: 'DB Update Failed.' });
      continue;
    }

    uploaded.push({
      file: fileName,
      product_id: productId,
      matched_by: matchedBy,
      public_url: publicUrl,
    });
    updatedProductIds.push(productId);
  }

  if (uploaded.length > 0) {
    await supabase.from('admin_audit_log').insert({
      actor_id: gate.userId,
      action: 'products_bulk_image_upload',
      entity_type: 'products',
      entity_id: null,
      changes: {
        uploaded_count: uploaded.length,
        skipped_count: skipped.length,
        product_ids: updatedProductIds,
      },
    });
  }

  return NextResponse.json({
    uploaded,
    skipped,
    summary: {
      total: files.length,
      uploaded: uploaded.length,
      skipped: skipped.length,
    },
  });
}
