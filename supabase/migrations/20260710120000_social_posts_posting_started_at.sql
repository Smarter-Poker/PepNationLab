-- Stuck-row recovery for the social autoposter.
--
-- The cron atomically claims a row (pending -> posting) and then calls the
-- platform API. If the serverless function times out or crashes in between,
-- the row is stranded in 'posting' forever: never retried, never surfaced.
--
-- posting_started_at lets the next cron run detect stranded rows. Critically,
-- they are swept to 'failed' (NOT back to 'pending'): the post may already
-- have gone live before the DB update failed, so an automatic retry could
-- publish it twice to a real account. A human verifies, then retries.
alter table public.social_posts
  add column if not exists posting_started_at timestamptz;

comment on column public.social_posts.posting_started_at is
  'When the cron claimed this row (pending -> posting). Used to detect stranded posts.';

-- Fast lookup of stranded rows.
create index if not exists social_posts_posting_started_idx
  on public.social_posts (status, posting_started_at)
  where status = 'posting';
