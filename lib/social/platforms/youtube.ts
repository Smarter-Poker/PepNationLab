/**
 * YouTube poster - uploads a Short via the Data API v3.
 *
 * Uses a resumable upload:
 *   1. POST https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable
 *      with the snippet+status metadata -> returns a session URL (Location).
 *   2. PUT the video bytes to that session URL.
 *
 * A vertical (<=60s) clip with #Shorts in the title/description is treated as a
 * Short by YouTube. Scope: https://www.googleapis.com/auth/youtube.upload.
 */
import { resolveCreds } from '../tokens';
import type { PostInput, PostResult } from '../types';

export async function postYouTube(input: PostInput): Promise<PostResult> {
  const { accessToken } = await resolveCreds('google');
  if (!input.mediaUrl || input.mediaType !== 'video') {
    throw new Error('youtube: requires a public video URL (mediaType=video)');
  }

  // Derive a title from the first line; ensure #Shorts is present.
  const firstLine = input.caption.split('\n')[0].slice(0, 90);
  const title = /#shorts/i.test(input.caption) ? firstLine : `${firstLine} #Shorts`;
  const description =
    (input.link ? `${input.caption}\n\n${input.link}` : input.caption) +
    (/#shorts/i.test(input.caption) ? '' : '\n\n#Shorts');

  const metadata = {
    snippet: {
      title: title.slice(0, 100),
      description: description.slice(0, 4900),
      categoryId: '27', // Education
    },
    status: {
      privacyStatus: 'public',
      selfDeclaredMadeForKids: false,
    },
  };

  // Fetch the media bytes (Supabase public URL) to stream into the upload.
  const mediaRes = await fetch(input.mediaUrl);
  if (!mediaRes.ok) throw new Error(`youtube: could not fetch video (${mediaRes.status})`);
  const videoBytes = Buffer.from(await mediaRes.arrayBuffer());

  // 1) start resumable session
  const startRes = await fetch(
    'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Upload-Content-Type': 'video/mp4',
        'X-Upload-Content-Length': String(videoBytes.length),
      },
      body: JSON.stringify(metadata),
    },
  );
  if (!startRes.ok) {
    const t = await startRes.text().catch(() => '');
    throw new Error(`youtube: resumable start failed (${startRes.status}): ${t.slice(0, 300)}`);
  }
  const sessionUrl = startRes.headers.get('location');
  if (!sessionUrl) throw new Error('youtube: no resumable session URL returned');

  // 2) upload bytes
  const uploadRes = await fetch(sessionUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': 'video/mp4',
      'Content-Length': String(videoBytes.length),
    },
    body: videoBytes,
  });
  const json = (await uploadRes.json().catch(() => ({}))) as { id?: string };
  if (!uploadRes.ok || !json.id) {
    throw new Error(`youtube upload failed (${uploadRes.status}): ${JSON.stringify(json).slice(0, 300)}`);
  }
  return { id: json.id, url: `https://youtube.com/shorts/${json.id}` };
}
