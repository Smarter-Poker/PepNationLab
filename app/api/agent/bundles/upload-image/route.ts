import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { requireAgentOrAdmin } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Allow up to 8 MB images
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const gate = await requireAgentOrAdmin();
  if (!gate.ok) return gate.response;

  const agentId = gate.user.id;

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Expected multipart/form-data' }, { status: 400 });
  }

  const file = formData.get('file') as File | null;
  if (!file || !file.size) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  if (file.size > 8 * 1024 * 1024) {
    return NextResponse.json({ error: 'File too large (max 8 MB)' }, { status: 413 });
  }

  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json({ error: 'Unsupported file type. Use JPG, PNG, WEBP, GIF, or SVG.' }, { status: 415 });
  }

  const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
  const path = `bundle-images/${agentId}-${Date.now()}.${ext}`;

  const svc = await createAdminClient();

  // Upload via service role — bypasses RLS entirely
  const bytes = await file.arrayBuffer();
  const { error: uploadError } = await svc.storage
    .from('public-assets')
    .upload(path, bytes, {
      contentType: file.type,
      upsert: true,
    });

  if (uploadError) {
    console.error('[bundle-image-upload] storage error:', uploadError);
    return NextResponse.json({ error: 'Storage Upload Failed. Please Try Again.' }, { status: 500 });
  }

  const { data: pub } = svc.storage.from('public-assets').getPublicUrl(path);
  return NextResponse.json({ url: pub.publicUrl });
}
