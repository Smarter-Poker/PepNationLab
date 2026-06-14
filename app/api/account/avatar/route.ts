import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';
import { sniffImageMime, ALLOWED_IMAGE_MIME, EXT_BY_MIME } from '@/lib/image-sniff';

const ALLOWED_MIME: readonly string[] = ALLOWED_IMAGE_MIME;

export async function POST(request: NextRequest) {
  const csrf = assertSameOrigin(request);
  if (csrf) return csrf;

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate size (5MB limit enforced here too)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'File exceeds 5MB limit' }, { status: 400 });
    }

    // Read the bytes once so we can validate by content and reuse for upload.
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    // Validate the declared MIME...
    if (!ALLOWED_MIME.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type. Only JPG, PNG, WEBP, and GIF are allowed.' }, { status: 400 });
    }

    // ...and confirm the actual file content matches a supported image format.
    const sniffed = sniffImageMime(bytes);
    if (!sniffed) {
      return NextResponse.json({ error: 'File content is not a valid image.' }, { status: 400 });
    }

    // Use the sniffed type for the stored extension (source of truth).
    const ext = EXT_BY_MIME[sniffed] || 'jpg';
    const filename = `${user.id}/avatar-${Date.now()}.${ext}`;

    // Upload to Supabase Storage
    const { error } = await supabase.storage
      .from('avatars')
      .upload(filename, bytes, {
        cacheControl: '3600',
        upsert: true,
        contentType: sniffed,
      });

    if (error) {
      console.error('Avatar upload error:', error);
      return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 });
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(filename);

    // Update profiles table
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ avatar_url: publicUrl })
      .eq('id', user.id);

    if (profileError) {
      console.error('Profile update error:', profileError);
      return NextResponse.json({ error: 'Failed to link avatar to profile' }, { status: 500 });
    }

    // Best-effort cleanup: remove the user's previous avatar files so the
    // bucket does not accumulate orphans. Never let this fail the request.
    try {
      const { data: existing } = await supabase.storage
        .from('avatars')
        .list(user.id, { limit: 100 });

      if (existing && existing.length > 0) {
        const newBasename = filename.split('/').pop();
        const stale = existing
          .filter((f) => f.name !== newBasename)
          .map((f) => `${user.id}/${f.name}`);
        if (stale.length > 0) {
          await supabase.storage.from('avatars').remove(stale);
        }
      }
    } catch (cleanupErr) {
      console.error('Avatar cleanup (non-fatal):', cleanupErr);
    }

    return NextResponse.json({ avatar_url: publicUrl });

  } catch (err: unknown) {
    console.error('Avatar POST error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Reset the avatar back to the default (initials). Clears profiles.avatar_url
// and best-effort removes the user's stored avatar files so the bucket does not
// keep orphans. Used by the "Use Default" control.
export async function DELETE(request: NextRequest) {
  const csrf = assertSameOrigin(request);
  if (csrf) return csrf;

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { error: profileError } = await supabase
      .from('profiles')
      .update({ avatar_url: null })
      .eq('id', user.id);

    if (profileError) {
      console.error('Avatar reset profile update error:', profileError);
      return NextResponse.json({ error: 'Failed to reset avatar' }, { status: 500 });
    }

    // Best-effort: remove all of the user's stored avatar files.
    try {
      const { data: existing } = await supabase.storage
        .from('avatars')
        .list(user.id, { limit: 100 });

      if (existing && existing.length > 0) {
        const all = existing.map((f) => `${user.id}/${f.name}`);
        if (all.length > 0) {
          await supabase.storage.from('avatars').remove(all);
        }
      }
    } catch (cleanupErr) {
      console.error('Avatar reset cleanup (non-fatal):', cleanupErr);
    }

    return NextResponse.json({ avatar_url: null });

  } catch (err: unknown) {
    console.error('Avatar DELETE error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
