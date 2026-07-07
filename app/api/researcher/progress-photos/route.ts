// Progress photos API for the Lab Journal. Backed by the researcher_progress_photos
// table and the private 'progress-photos' storage bucket (migration 20260707220000).
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';

export const dynamic = 'force-dynamic';

const BUCKET = 'progress-photos';
const MAX_PHOTOS = 200;
const MAX_BYTES = 6 * 1024 * 1024; // 6MB decoded ceiling

async function signRows(service: any, rows: any[]) {
  const out: any[] = [];
  for (const r of rows) {
    let url: string | null = null;
    try {
      const { data } = await service.storage.from(BUCKET).createSignedUrl(r.storage_path, 3600);
      url = data?.signedUrl ?? null;
    } catch {}
    out.push({ id: r.id, caption: r.caption, taken_at: r.taken_at, created_at: r.created_at, url });
  }
  return out;
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const service = await createServiceClient();
  const { data, error } = await service
    .from('researcher_progress_photos')
    .select('id, caption, taken_at, created_at, storage_path')
    .eq('user_id', user.id)
    .order('taken_at', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching progress photos:', error);
    return NextResponse.json({ error: 'Failed to fetch progress photos' }, { status: 500 });
  }

  const photos = await signRows(service, data ?? []);
  return NextResponse.json({ photos });
}

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { image_base64, caption, taken_at } = await req.json();

    if (typeof image_base64 !== 'string' || !image_base64) {
      return NextResponse.json({ error: 'Image is required' }, { status: 400 });
    }
    if (caption != null && (typeof caption !== 'string' || caption.length > 300)) {
      return NextResponse.json({ error: 'Caption too long' }, { status: 400 });
    }

    let takenDate = new Date();
    if (taken_at) {
      const d = new Date(taken_at);
      if (isNaN(d.getTime())) return NextResponse.json({ error: 'Invalid date' }, { status: 400 });
      takenDate = d;
    }
    const takenStr = takenDate.toISOString().split('T')[0];

    // Accept data URL or raw base64; only JPEG/PNG/WebP
    const m = image_base64.match(/^data:(image\/(jpeg|png|webp));base64,(.+)$/);
    const b64 = m ? m[3] : image_base64;
    const contentType = m ? m[1] : 'image/jpeg';
    const ext = contentType === 'image/png' ? 'png' : contentType === 'image/webp' ? 'webp' : 'jpg';

    const buffer = Buffer.from(b64, 'base64');
    if (buffer.length === 0) return NextResponse.json({ error: 'Empty image' }, { status: 400 });
    if (buffer.length > MAX_BYTES) return NextResponse.json({ error: 'Image too large (max 6MB)' }, { status: 413 });

    const service = await createServiceClient();

    const { count } = await service
      .from('researcher_progress_photos')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id);
    if ((count ?? 0) >= MAX_PHOTOS) {
      return NextResponse.json({ error: `Photo limit reached (${MAX_PHOTOS})` }, { status: 429 });
    }

    const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await service.storage.from(BUCKET).upload(path, buffer, { contentType, upsert: false });
    if (upErr) {
      console.error('Storage upload error:', upErr);
      return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
    }

    const { data: row, error: insErr } = await service
      .from('researcher_progress_photos')
      .insert({ user_id: user.id, storage_path: path, caption: caption || null, taken_at: takenStr })
      .select('id, caption, taken_at, created_at, storage_path')
      .maybeSingle();

    if (insErr || !row) {
      // best-effort cleanup of the orphaned object
      try { await service.storage.from(BUCKET).remove([path]); } catch {}
      console.error('Insert error:', insErr);
      return NextResponse.json({ error: 'Failed to save photo record' }, { status: 500 });
    }

    const [photo] = await signRows(service, [row]);
    return NextResponse.json({ photo });
  } catch (e) {
    console.error('Error uploading progress photo:', e);
    return NextResponse.json({ error: 'Failed to upload photo' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

    const service = await createServiceClient();
    const { data: row } = await service
      .from('researcher_progress_photos')
      .select('id, storage_path, user_id')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    try { await service.storage.from(BUCKET).remove([row.storage_path]); } catch {}
    const { error } = await service
      .from('researcher_progress_photos')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);
    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('Error deleting progress photo:', e);
    return NextResponse.json({ error: 'Failed to delete photo' }, { status: 500 });
  }
}
