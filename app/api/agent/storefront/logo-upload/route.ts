/**
 * POST /api/agent/storefront/logo-upload
 *
 * Accepts a multipart/form-data upload with a `file` field.
 * Uses the service-role client to store the file in the `storefront-assets`
 * bucket (bypassing RLS entirely — auth is enforced by requireAgentOrAdmin).
 * Writes the public URL back to agent_profiles.logo_url and returns it.
 *
 * This replaces the previous browser-side upload which was hitting RLS
 * INSERT policy conflicts when policies from different migrations coexisted.
 */
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { requireAgentOrAdmin } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Allow up to 8 MB images
export const maxDuration = 30;

export async function POST(req: Request) {
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

  // Limit to 8 MB
  if (file.size > 8 * 1024 * 1024) {
    return NextResponse.json({ error: 'File too large (max 8 MB)' }, { status: 413 });
  }

  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json({ error: 'Unsupported file type. Use JPG, PNG, WEBP, GIF, or SVG.' }, { status: 415 });
  }

  const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
  // Path: {agentId}/logo-{timestamp}.{ext}
  // First segment = agentId (matches existing RLS pattern too)
  const path = `${agentId}/logo-${Date.now()}.${ext}`;

  const svc = await createAdminClient();

  // Upload via service role — bypasses RLS entirely
  const bytes = await file.arrayBuffer();
  const { error: uploadError } = await svc.storage
    .from('storefront-assets')
    .upload(path, bytes, {
      contentType: file.type,
      upsert: true,
    });

  if (uploadError) {
    console.error('[logo-upload] storage error:', uploadError);
    return NextResponse.json({ error: 'Storage Upload Failed. Please Try Again.' }, { status: 500 });
  }

  const { data: pub } = svc.storage.from('storefront-assets').getPublicUrl(path);
  const publicUrl = pub.publicUrl;

  // Persist to agent_profiles
  const { error: dbError } = await svc
    .from('agent_profiles')
    .update({ logo_url: publicUrl })
    .eq('id', agentId);

  if (dbError) {
    console.error('[logo-upload] db write error:', dbError);
    return NextResponse.json({ error: 'Upload Saved But Could Not Update Your Storefront. Please Try Again.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, url: publicUrl });
}
