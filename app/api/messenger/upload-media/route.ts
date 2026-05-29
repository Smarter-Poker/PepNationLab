import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';
import { requireSession } from '@/lib/messenger/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED_MIME = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'video/mp4', 'video/webm',
  'audio/webm', 'audio/mp4', 'audio/mpeg',
  'application/pdf',
]);

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp',
  'video/mp4': 'mp4', 'video/webm': 'webm',
  'audio/webm': 'webm', 'audio/mp4': 'm4a', 'audio/mpeg': 'mp3',
  'application/pdf': 'pdf',
};

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const { user, error } = await requireSession();
  if (error) return NextResponse.json({ error }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { contentType?: string; bytes?: number };
  const contentType = String(body.contentType ?? '').toLowerCase();
  const bytes = Number(body.bytes ?? 0);

  if (!ALLOWED_MIME.has(contentType)) {
    return NextResponse.json({ error: 'Unsupported Content Type' }, { status: 400 });
  }
  if (!Number.isFinite(bytes) || bytes <= 0 || bytes > 50 * 1024 * 1024) {
    return NextResponse.json({ error: 'Invalid Size' }, { status: 400 });
  }

  const ext = MIME_TO_EXT[contentType];
  const path = `${user.id}/${crypto.randomUUID()}.${ext}`;

  const svc = await createServiceClient();
  const { data, error: signErr } = await svc.storage.from('messenger_media').createSignedUploadUrl(path);
  if (signErr || !data) {
    return NextResponse.json({ error: signErr?.message ?? 'Sign Failed' }, { status: 500 });
  }
  const { data: pub } = svc.storage.from('messenger_media').getPublicUrl(path);
  return NextResponse.json({
    uploadUrl: data.signedUrl,
    token: data.token,
    path,
    publicUrl: pub.publicUrl,
  });
}
