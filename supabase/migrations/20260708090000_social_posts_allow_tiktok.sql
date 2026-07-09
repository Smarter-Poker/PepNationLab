-- The autoposter gained a TikTok poster (lib/social/platforms/tiktok.ts) and the
-- Platform type now includes 'tiktok', but social_posts.platform still rejected
-- it, so any queued TikTok post failed the check constraint on insert. Widen the
-- check. social_accounts.provider already allows 'tiktok'.
alter table public.social_posts
  drop constraint if exists social_posts_platform_check;

alter table public.social_posts
  add constraint social_posts_platform_check
  check (platform in ('x', 'youtube', 'instagram', 'facebook', 'pinterest', 'tiktok'));
