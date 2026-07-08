/**
 * Meta poster - one app covers both Instagram (Business/Creator) and the
 * Facebook Page. Uses the Graph API and a long-lived Page access token.
 *
 * Instagram (video/Reels or image):
 *   1. POST /{ig_business_id}/media  (video_url|image_url + caption)  -> container id
 *   2. poll GET /{container_id}?fields=status_code until FINISHED
 *   3. POST /{ig_business_id}/media_publish  (creation_id=container id)
 *
 * Facebook Page:
 *   image  -> POST /{page_id}/photos     (url + caption)
 *   video  -> POST /{page_id}/videos     (file_url + description)
 *   text   -> POST /{page_id}/feed       (message)
 */
import { resolveCreds } from '../tokens';
import type { PostInput, PostResult } from '../types';

const GRAPH = 'https://graph.facebook.com/v21.0';

export async function postInstagram(input: PostInput): Promise<PostResult> {
  const { accessToken, accountRef } = await resolveCreds('meta');
  const igId = accountRef.ig_business_id;
  if (!igId) throw new Error('instagram: no ig_business_id configured');
  if (!input.mediaUrl || input.mediaType === 'none') {
    throw new Error('instagram: requires a public media URL');
  }

  const caption = input.link ? `${input.caption}\n\n${input.link}` : input.caption;

  // 1) create container
  const createParams = new URLSearchParams({ access_token: accessToken, caption });
  if (input.mediaType === 'video') {
    createParams.set('media_type', 'REELS');
    createParams.set('video_url', input.mediaUrl);
  } else {
    createParams.set('image_url', input.mediaUrl);
  }
  const createRes = await fetch(`${GRAPH}/${igId}/media`, {
    method: 'POST',
    body: createParams,
  });
  const createJson = (await createRes.json().catch(() => ({}))) as Record<string, unknown>;
  const containerId = createJson.id as string | undefined;
  if (!createRes.ok || !containerId) {
    throw new Error(`instagram container failed (${createRes.status}): ${JSON.stringify(createJson).slice(0, 300)}`);
  }

  // 2) poll until ready (video needs processing; images are usually instant)
  for (let i = 0; i < 30; i += 1) {
    const statusRes = await fetch(
      `${GRAPH}/${containerId}?fields=status_code&access_token=${encodeURIComponent(accessToken)}`,
    );
    const statusJson = (await statusRes.json().catch(() => ({}))) as { status_code?: string };
    if (statusJson.status_code === 'FINISHED') break;
    if (statusJson.status_code === 'ERROR') throw new Error('instagram: media processing error');
    await new Promise((r) => setTimeout(r, 4000));
  }

  // 3) publish
  const publishRes = await fetch(`${GRAPH}/${igId}/media_publish`, {
    method: 'POST',
    body: new URLSearchParams({ access_token: accessToken, creation_id: containerId }),
  });
  const publishJson = (await publishRes.json().catch(() => ({}))) as Record<string, unknown>;
  const id = publishJson.id as string | undefined;
  if (!publishRes.ok || !id) {
    throw new Error(`instagram publish failed (${publishRes.status}): ${JSON.stringify(publishJson).slice(0, 300)}`);
  }
  return { id, url: `https://www.instagram.com/p/${id}/` };
}

export async function postFacebook(input: PostInput): Promise<PostResult> {
  const { accessToken, accountRef } = await resolveCreds('meta');
  const pageId = accountRef.page_id;
  const pageToken = accountRef.page_token || accessToken;
  if (!pageId) throw new Error('facebook: no page_id configured');

  const message = input.link ? `${input.caption}\n\n${input.link}` : input.caption;

  let endpoint: string;
  const params = new URLSearchParams({ access_token: pageToken });
  if (input.mediaType === 'image' && input.mediaUrl) {
    endpoint = `${GRAPH}/${pageId}/photos`;
    params.set('url', input.mediaUrl);
    params.set('caption', message);
  } else if (input.mediaType === 'video' && input.mediaUrl) {
    endpoint = `${GRAPH}/${pageId}/videos`;
    params.set('file_url', input.mediaUrl);
    params.set('description', message);
  } else {
    endpoint = `${GRAPH}/${pageId}/feed`;
    params.set('message', message);
  }

  const res = await fetch(endpoint, { method: 'POST', body: params });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  const id = (json.id ?? json.post_id) as string | undefined;
  if (!res.ok || !id) {
    throw new Error(`facebook post failed (${res.status}): ${JSON.stringify(json).slice(0, 300)}`);
  }
  return { id, url: `https://www.facebook.com/${id}` };
}
