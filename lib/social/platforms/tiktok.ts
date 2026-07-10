/**
 * TikTok poster - Content Posting API v2 (PULL_FROM_URL).
 *
 * Two things make TikTok different from the other platforms and both have bitten
 * this code before:
 *
 *  1. Auth. TikTok uses client_key/client_secret (not HTTP Basic), so it goes
 *     through resolveCreds() like every other platform rather than reading the
 *     access_token straight out of the database - otherwise an expired token can
 *     never refresh and posting silently dies after ~24h.
 *
 *  2. Publishing is ASYNCHRONOUS. /video/init/ returns a publish_id immediately,
 *     long before TikTok has fetched and processed the video. Treating that as
 *     "posted" marks failures as successes. We poll /publish/status/fetch/ until
 *     the upload actually reaches a terminal state.
 *
 * Prerequisites (fail loudly, not silently):
 *  - The app must be audited for the video.publish scope, and the media host
 *    domain must be verified with TikTok, or PULL_FROM_URL is rejected.
 *  - Unaudited apps can only post privacy_level SELF_ONLY. Override with
 *    TIKTOK_PRIVACY_LEVEL if your app has passed audit.
 */
import { resolveCreds } from '../tokens';
import type { PostInput, PostResult } from '../types';

const API = 'https://open.tiktokapis.com/v2';
const POLL_ATTEMPTS = 20;
const POLL_INTERVAL_MS = 3000;

type StatusResponse = {
  data?: { status?: string; publicaly_available_post_id?: string[]; fail_reason?: string };
  error?: { code?: string; message?: string };
};

export async function postTikTok(input: PostInput): Promise<PostResult> {
  if (input.mediaType !== 'video' || !input.mediaUrl) {
    throw new Error('tiktok: requires a public video URL (mediaType=video)');
  }

  // Shared token layer: refreshes an expired access token automatically.
  const { accessToken } = await resolveCreds('tiktok');

  const privacyLevel = process.env.TIKTOK_PRIVACY_LEVEL || 'SELF_ONLY';

  // 1) Initialize the pull-from-url upload.
  const initRes = await fetch(`${API}/post/publish/video/init/`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json; charset=UTF-8',
    },
    body: JSON.stringify({
      post_info: {
        title: input.caption.slice(0, 2200),
        privacy_level: privacyLevel,
        disable_duet: false,
        disable_comment: false,
        disable_stitch: false,
        video_cover_timestamp_ms: 1000,
      },
      source_info: {
        source: 'PULL_FROM_URL',
        video_url: input.mediaUrl,
      },
    }),
  });

  const initJson = (await initRes.json().catch(() => ({}))) as {
    data?: { publish_id?: string };
    error?: { code?: string; message?: string };
  };

  if (!initRes.ok || (initJson.error?.code && initJson.error.code !== 'ok')) {
    throw new Error(
      `tiktok init failed (${initRes.status}): ${JSON.stringify(initJson).slice(0, 400)}`,
    );
  }

  const publishId = initJson.data?.publish_id;
  if (!publishId) {
    throw new Error(`tiktok init returned no publish_id: ${JSON.stringify(initJson).slice(0, 300)}`);
  }

  // 2) Poll until the upload reaches a terminal state. Reporting success off the
  //    init call alone would mark processing failures as "posted".
  for (let i = 0; i < POLL_ATTEMPTS; i += 1) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

    const statusRes = await fetch(`${API}/post/publish/status/fetch/`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
      },
      body: JSON.stringify({ publish_id: publishId }),
    });
    const statusJson = (await statusRes.json().catch(() => ({}))) as StatusResponse;
    const status = statusJson.data?.status;

    if (status === 'PUBLISH_COMPLETE') {
      const postId = statusJson.data?.publicaly_available_post_id?.[0];
      return {
        id: postId ?? publishId,
        url: postId ? `https://www.tiktok.com/video/${postId}` : undefined,
      };
    }
    if (status === 'FAILED') {
      throw new Error(
        `tiktok publish failed: ${statusJson.data?.fail_reason ?? 'unknown reason'}`,
      );
    }
    // PROCESSING_UPLOAD / PROCESSING_DOWNLOAD / SEND_TO_USER_INBOX -> keep polling
  }

  // Never claim success we have not observed.
  throw new Error(
    `tiktok publish still processing after ${(POLL_ATTEMPTS * POLL_INTERVAL_MS) / 1000}s ` +
      `(publish_id ${publishId}). Verify on the account before retrying.`,
  );
}
