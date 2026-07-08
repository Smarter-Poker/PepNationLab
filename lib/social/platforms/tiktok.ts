import { createClient } from '@supabase/supabase-js';
import type { PostInput, PostResult, SocialAccount } from '../types';

export async function postTikTok(input: PostInput): Promise<PostResult> {
  if (input.mediaType !== 'video' || !input.mediaUrl) {
    throw new Error('tiktok: TikTok requires a video (mediaType: video).');
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: account, error } = await supabase
    .from('social_accounts')
    .select('*')
    .eq('provider', 'tiktok')
    .single();

  if (error || !account?.access_token) {
    throw new Error('tiktok: No authenticated TikTok account found.');
  }

  // 1) Initialize upload
  const initBody = {
    post_info: {
      title: input.caption,
      privacy_level: 'PUBLIC_TO_EVERYONE',
      disable_duet: false,
      disable_comment: false,
      disable_stitch: false,
      video_cover_timestamp_ms: 1000,
    },
    source_info: {
      source: 'PULL_FROM_URL',
      video_url: input.mediaUrl,
    },
  };

  const initRes = await fetch('https://open.tiktokapis.com/v2/post/publish/video/init/', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${account.access_token}`,
      'Content-Type': 'application/json; charset=UTF-8',
    },
    body: JSON.stringify(initBody),
  });

  const initJson = await initRes.json();

  if (!initRes.ok || initJson.error?.code !== 'ok') {
    throw new Error(`tiktok API failed: ${JSON.stringify(initJson)}`);
  }

  // TikTok pull-from-url is asynchronous. We get a publish_id back immediately.
  const publishId = initJson.data?.publish_id;

  if (!publishId) {
    throw new Error(`tiktok API failed to return publish_id: ${JSON.stringify(initJson)}`);
  }

  return {
    id: publishId,
    // Note: TikTok v2 API does not return a direct public permalink upon init.
    // The video will eventually be published on the user's profile.
  };
}
