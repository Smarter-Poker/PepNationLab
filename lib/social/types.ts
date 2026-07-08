/** Shared types for the social autoposter engine. */

export type Platform = 'x' | 'youtube' | 'instagram' | 'facebook' | 'pinterest' | 'tiktok';
export type Provider = 'x' | 'google' | 'meta' | 'pinterest' | 'tiktok';
export type MediaType = 'video' | 'image' | 'none';

/** A queue row from public.social_posts. */
export interface SocialPost {
  id: string;
  platform: Platform;
  media_url: string | null;
  media_type: MediaType;
  caption: string;
  link: string | null;
  scheduled_for: string;
  status: 'pending' | 'posting' | 'posted' | 'failed' | 'blocked';
  attempts: number;
  compliance_checked: boolean;
  compliance_notes: string | null;
  posted_at: string | null;
  platform_post_id: string | null;
  platform_url: string | null;
  error: string | null;
  source: string | null;
  dedupe_key: string | null;
}

/** A connected-platform credential row from public.social_accounts. */
export interface SocialAccount {
  id: string;
  provider: Provider;
  access_token: string | null;
  refresh_token: string | null;
  expires_at: string | null;
  scope: string | null;
  account_ref: Record<string, string>;
  display_label: string | null;
}

/** Normalized input each platform poster receives. */
export interface PostInput {
  mediaUrl: string | null;
  mediaType: MediaType;
  caption: string;
  link: string | null;
}

/** Normalized result each platform poster returns. */
export interface PostResult {
  id: string; // platform post id
  url?: string; // permalink, when derivable
}

export function providerForPlatform(platform: Platform): Provider {
  switch (platform) {
    case 'x':
      return 'x';
    case 'youtube':
      return 'google';
    case 'instagram':
    case 'facebook':
      return 'meta';
    case 'pinterest':
      return 'pinterest';
    case 'tiktok':
      return 'tiktok';
  }
}
