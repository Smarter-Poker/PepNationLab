// Read-time signing for messenger media. The `messenger_media` bucket is
// private (migration 20260708120000). Uploads still store the full public URL
// (https://<ref>.supabase.co/storage/v1/object/public/messenger_media/<path>)
// in messenger_messages.media_url, and GIFs store an external Tenor URL in the
// same column. At read time we re-sign the stored value into a short-lived
// signed URL so the media renders without exposing the bucket publicly.
//
// This does NOT change what the DB stores or the upload flow -- it only
// rewrites the URL on outgoing rows right before the JSON response/broadcast.
import { createServiceClient } from '@/lib/supabase/server';

const BUCKET = 'messenger_media';
const SIGNED_URL_TTL_SECONDS = 3600;

/**
 * Derive the storage object path for the `messenger_media` bucket from a stored
 * media_url. Returns null when the value is not a signable messenger object
 * (e.g. an external Tenor GIF or an unknown host) -- callers treat null as
 * "return the value unchanged".
 */
function deriveObjectPath(stored: string): string | null {
  const marker = '/messenger_media/';
  const markerIdx = stored.indexOf(marker);
  if (markerIdx !== -1) {
    let path = stored.slice(markerIdx + marker.length);
    const q = path.indexOf('?');
    if (q !== -1) path = path.slice(0, q);
    return path || null;
  }
  // Bare relative path (no scheme) -- treat as an object path as-is.
  if (!stored.includes('://')) {
    let path = stored;
    const q = path.indexOf('?');
    if (q !== -1) path = path.slice(0, q);
    return path || null;
  }
  // Unknown absolute host -- not a messenger object, leave unchanged.
  return null;
}

/**
 * Re-sign a single stored media_url into a short-lived signed URL.
 * - Falsy input returns the input (null-normalized).
 * - Tenor GIF URLs are returned unchanged.
 * - Non-messenger absolute URLs are returned unchanged.
 * - On any error the function returns null (never throws).
 */
export async function signMessengerMediaUrl(
  stored: string | null | undefined
): Promise<string | null> {
  if (!stored) return stored ?? null;

  try {
    // External Tenor GIFs live outside our storage -- never sign them.
    try {
      const parsed = new URL(stored);
      if (parsed.hostname.toLowerCase().endsWith('tenor.com')) {
        return stored;
      }
    } catch {
      // Not an absolute URL -- fall through to path derivation.
    }

    const path = deriveObjectPath(stored);
    if (path === null) {
      // Unknown host / unsignable -- leave it unchanged rather than break it.
      return stored;
    }

    const svc = await createServiceClient();
    const { data, error } = await svc.storage
      .from(BUCKET)
      .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
    if (error || !data?.signedUrl) return null;
    return data.signedUrl;
  } catch {
    return null;
  }
}

/**
 * Re-sign media_url on an array of rows, returning NEW objects with media_url
 * replaced. Rows without a media_url pass through untouched.
 */
export async function signMessengerMediaUrls<T extends { media_url?: string | null }>(
  rows: T[]
): Promise<T[]> {
  return Promise.all(
    rows.map(async (row) => {
      if (!row || row.media_url == null) return row;
      const signed = await signMessengerMediaUrl(row.media_url);
      return { ...row, media_url: signed };
    })
  );
}
