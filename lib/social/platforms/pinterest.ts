/**
 * Pinterest poster - creates a Pin from a public image URL.
 * API: POST https://api.pinterest.com/v5/pins
 * Scope: pins:write (+ boards:read). Needs a target board_id in account_ref.
 *
 * Pinterest is one of the two recommended "first" platforms (no app-review
 * wait), so this is the path to a first verified post.
 */
import { resolveCreds } from '../tokens';
import type { PostInput, PostResult } from '../types';

export async function postPinterest(input: PostInput): Promise<PostResult> {
  const { accessToken, accountRef } = await resolveCreds('pinterest');
  const boardId = accountRef.board_id;
  if (!boardId) {
    throw new Error('pinterest: no board_id configured (account_ref/PINTEREST_BOARD_ID)');
  }
  if (!input.mediaUrl || input.mediaType !== 'image') {
    throw new Error('pinterest: requires a public image URL (mediaType=image)');
  }

  const body = {
    board_id: boardId,
    title: input.caption.slice(0, 100),
    description: input.caption.slice(0, 800),
    link: input.link ?? undefined,
    media_source: {
      source_type: 'image_url',
      url: input.mediaUrl,
    },
  };

  const res = await fetch('https://api.pinterest.com/v5/pins', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok || !json.id) {
    throw new Error(
      `pinterest post failed (${res.status}): ${JSON.stringify(json).slice(0, 400)}`,
    );
  }
  const id = String(json.id);
  return { id, url: `https://www.pinterest.com/pin/${id}/` };
}
