/**
 * X (Twitter) poster.
 *
 * Text tweet:  POST https://api.twitter.com/2/tweets
 * With media:  upload bytes via v1.1 media/upload (chunked for video), then
 *              attach the returned media_id to the v2 tweet.
 * Scopes: tweet.read tweet.write users.read offline.access.
 *
 * Note: X's write API is a paid tier. This posts text + optional single media.
 */
import { resolveCreds } from '../tokens';
import type { PostInput, PostResult } from '../types';

const UPLOAD_URL = 'https://upload.twitter.com/1.1/media/upload.json';

async function fetchMediaBytes(url: string): Promise<{ bytes: Buffer; contentType: string }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`x: could not fetch media (${res.status})`);
  const contentType = res.headers.get('content-type') ?? 'application/octet-stream';
  const bytes = Buffer.from(await res.arrayBuffer());
  return { bytes, contentType };
}

/** Chunked upload (INIT/APPEND/FINALIZE) - works for both image and video. */
async function uploadMedia(token: string, input: PostInput): Promise<string> {
  const { bytes, contentType } = await fetchMediaBytes(input.mediaUrl as string);
  const mediaCategory = input.mediaType === 'video' ? 'tweet_video' : 'tweet_image';

  // INIT
  const initBody = new URLSearchParams({
    command: 'INIT',
    total_bytes: String(bytes.length),
    media_type: contentType,
    media_category: mediaCategory,
  });
  const initRes = await fetch(UPLOAD_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: initBody,
  });
  const initJson = (await initRes.json().catch(() => ({}))) as Record<string, unknown>;
  const mediaId = initJson.media_id_string as string | undefined;
  if (!initRes.ok || !mediaId) {
    throw new Error(`x: media INIT failed (${initRes.status}): ${JSON.stringify(initJson).slice(0, 300)}`);
  }

  // APPEND in 4MB chunks
  const CHUNK = 4 * 1024 * 1024;
  let segment = 0;
  for (let offset = 0; offset < bytes.length; offset += CHUNK) {
    const chunk = bytes.subarray(offset, offset + CHUNK);
    const form = new FormData();
    form.append('command', 'APPEND');
    form.append('media_id', mediaId);
    form.append('segment_index', String(segment));
    form.append('media', new Blob([chunk]));
    const appendRes = await fetch(UPLOAD_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    if (!appendRes.ok) {
      throw new Error(`x: media APPEND failed (${appendRes.status}) at segment ${segment}`);
    }
    segment += 1;
  }

  // FINALIZE
  const finalizeRes = await fetch(UPLOAD_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: new URLSearchParams({ command: 'FINALIZE', media_id: mediaId }),
  });
  const finalizeJson = (await finalizeRes.json().catch(() => ({}))) as Record<string, unknown>;
  if (!finalizeRes.ok) {
    throw new Error(`x: media FINALIZE failed (${finalizeRes.status}): ${JSON.stringify(finalizeJson).slice(0, 300)}`);
  }

  // Poll processing status for video
  let info = finalizeJson.processing_info as { state?: string; check_after_secs?: number } | undefined;
  let guard = 0;
  while (info && info.state && info.state !== 'succeeded' && guard < 20) {
    if (info.state === 'failed') throw new Error('x: media processing failed');
    await new Promise((r) => setTimeout(r, (info?.check_after_secs ?? 3) * 1000));
    const statusRes = await fetch(
      `${UPLOAD_URL}?command=STATUS&media_id=${mediaId}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const statusJson = (await statusRes.json().catch(() => ({}))) as Record<string, unknown>;
    info = statusJson.processing_info as typeof info;
    guard += 1;
  }

  return mediaId;
}

export async function postX(input: PostInput): Promise<PostResult> {
  const { accessToken } = await resolveCreds('x');

  const text = input.link ? `${input.caption}\n\n${input.link}` : input.caption;
  const payload: Record<string, unknown> = { text: text.slice(0, 4000) };

  if (input.mediaUrl && input.mediaType !== 'none') {
    const mediaId = await uploadMedia(accessToken, input);
    payload.media = { media_ids: [mediaId] };
  }

  const res = await fetch('https://api.twitter.com/2/tweets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const json = (await res.json().catch(() => ({}))) as { data?: { id?: string } };
  const id = json.data?.id;
  if (!res.ok || !id) {
    throw new Error(`x post failed (${res.status}): ${JSON.stringify(json).slice(0, 400)}`);
  }
  return { id, url: `https://x.com/i/web/status/${id}` };
}
