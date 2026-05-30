import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';
import { requireSession } from '@/lib/messenger/server';
import { messengerRateLimit, messengerRateLimitResponse } from '@/lib/messengerRateLimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED_MIME = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'video/mp4', 'video/webm', 'video/quicktime', 'video/x-m4v',
  'audio/webm', 'audio/mp4', 'audio/mpeg',
  'application/pdf',
]);

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp',
  'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov', 'video/x-m4v': 'm4v',
  'audio/webm': 'webm', 'audio/mp4': 'm4a', 'audio/mpeg': 'mp3',
  'application/pdf': 'pdf',
};

// Video files need higher size limit than images
const MAX_BYTES: Record<string, number> = {
  default: 50 * 1024 * 1024,   // 50 MB for images, audio, PDF
  video: 200 * 1024 * 1024,    // 200 MB for video
};

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const { user, error } = await requireSession();
  if (error) return NextResponse.json({ error }, { status: 401 });

  const limited = await messengerRateLimit('upload', user.id);
  if (!limited.allowed) return messengerRateLimitResponse(limited);

  const body = (await req.json().catch(() => ({}))) as { contentType?: string; bytes?: number };
  const contentType = String(body.contentType ?? '').toLowerCase();
  const bytes = Number(body.bytes ?? 0);

  if (!ALLOWED_MIME.has(contentType)) {
    return NextResponse.json({ error: 'Unsupported Content Type' }, { status: 400 });
  }
  const isVideo = contentType.startsWith('video/');
  const maxBytes = isVideo ? MAX_BYTES.video : MAX_BYTES.default;
  if (!Number.isFinite(bytes) || bytes <= 0 || bytes > maxBytes) {
    return NextResponse.json(
      { error: isVideo ? 'Video Too Large (200 MB Max)' : 'File Too Large (50 MB Max)' },
      { status: 400 }
    );
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
