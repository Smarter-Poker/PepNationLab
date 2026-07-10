-- Social Autoposter: publishing queue + OAuth token store.
--
-- Adds the two tables the autoposter engine needs:
--   * social_accounts - one row per connected platform, holding the OAuth
--     tokens captured by the /api/social/oauth/[provider] flow (or seeded
--     from env). Service-role only; these are secrets.
--   * social_posts - the publish queue. gen/grok pipeline (or an admin) inserts
--     rows; /api/cron/social-autopost drains them, runs the compliance gate,
--     posts to the platform, and records the result.
--
-- Both tables are RLS-enabled with NO policies, so only the service-role key
-- (which bypasses RLS) can touch them. No researcher/agent/anon access.

-- ---------------------------------------------------------------------------
-- social_accounts: connected-platform credentials
-- ---------------------------------------------------------------------------
create table if not exists public.social_accounts (
  id            uuid primary key default gen_random_uuid(),
  -- oauth provider key. 'google' covers YouTube; 'meta' covers IG + FB Page.
  provider      text not null unique
                  check (provider in ('x', 'google', 'meta', 'pinterest', 'tiktok')),
  access_token  text,                 -- short-lived; refreshed from refresh_token
  refresh_token text,                 -- long-lived (x, google, pinterest)
  expires_at    timestamptz,          -- when access_token expires (if known)
  scope         text,
  -- provider-specific ids the posters need:
  --   meta      -> { "page_id": "...", "page_token": "...", "ig_business_id": "..." }
  --   pinterest -> { "board_id": "..." }
  --   google    -> { "channel_id": "..." }
  account_ref   jsonb not null default '{}'::jsonb,
  display_label text,                  -- human label, e.g. "@PepNationLab"
  connected_at  timestamptz,
  updated_at    timestamptz not null default now(),
  created_at    timestamptz not null default now()
);

comment on table public.social_accounts is
  'OAuth tokens + platform ids for the social autoposter. Service-role only (secrets).';

-- ---------------------------------------------------------------------------
-- social_posts: the publish queue
-- ---------------------------------------------------------------------------
create table if not exists public.social_posts (
  id                 uuid primary key default gen_random_uuid(),
  platform           text not null
                       check (platform in ('x', 'youtube', 'instagram', 'facebook', 'pinterest')),
  media_url          text,            -- public URL to MP4/PNG (null for text-only)
  media_type         text not null default 'none'
                       check (media_type in ('video', 'image', 'none')),
  caption            text not null,
  link               text,
  scheduled_for      timestamptz not null default now(),
  status             text not null default 'pending'
                       check (status in ('pending', 'posting', 'posted', 'failed', 'blocked')),
  attempts           integer not null default 0,
  compliance_checked boolean not null default false,
  compliance_notes   text,
  posted_at          timestamptz,
  platform_post_id   text,
  platform_url       text,
  error              text,
  -- optional linkage back to the generation batch that produced the asset
  source             text,            -- e.g. 'grok', 'manual', 'batch-2026-07'
  dedupe_key         text,            -- optional idempotency key for inserts
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

comment on table public.social_posts is
  'Social publishing queue drained hourly by /api/cron/social-autopost.';

-- Cron selects pending rows due now, oldest first.
create index if not exists social_posts_due_idx
  on public.social_posts (status, scheduled_for);

-- Prevent accidental duplicate inserts of the same asset when a dedupe_key is set.
create unique index if not exists social_posts_dedupe_key_uidx
  on public.social_posts (dedupe_key)
  where dedupe_key is not null;

-- keep updated_at fresh
create or replace function public.tg_social_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_social_posts_touch on public.social_posts;
create trigger trg_social_posts_touch
  before update on public.social_posts
  for each row execute function public.tg_social_touch_updated_at();

drop trigger if exists trg_social_accounts_touch on public.social_accounts;
create trigger trg_social_accounts_touch
  before update on public.social_accounts
  for each row execute function public.tg_social_touch_updated_at();

-- ---------------------------------------------------------------------------
-- RLS: lock down to service-role only (no policies => no anon/authenticated access)
-- ---------------------------------------------------------------------------
alter table public.social_accounts enable row level security;
alter table public.social_posts    enable row level security;

-- Belt-and-suspenders: explicitly revoke the API roles. Service role bypasses RLS.
revoke all on public.social_accounts from anon, authenticated;
revoke all on public.social_posts    from anon, authenticated;
