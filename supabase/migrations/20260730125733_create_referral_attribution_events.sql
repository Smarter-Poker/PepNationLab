-- Audit trail for referral attribution decisions.
--
-- Before this table the only surviving record of "agent X got credit for
-- researcher Y" was the final referred_by column. When attribution looked
-- wrong there was no way to reconstruct WHY: was there a signed QR lock, was
-- it minted by a typed storefront URL, was it just the signup form's own
-- field, and when was the lock created? Commission disputes were
-- unresolvable. This is append-only forensic history, not application state --
-- nothing reads it on a request path.
--
-- Service-role only: RLS is enabled with NO policies, so anon and
-- authenticated clients see nothing. Only lib/attribution-log.ts (admin
-- client) writes here.

create table if not exists public.referral_attribution_events (
  id             bigserial primary key,
  created_at     timestamptz not null default now(),
  event          text        not null,
  channel        text        not null,
  source         text        not null,
  user_id        uuid,
  agent_id       uuid,
  sub_agent_id   uuid,
  ref_code       text,
  store_slug     text,
  lock_minted_at timestamptz,
  detail         jsonb
);

comment on table public.referral_attribution_events is
  'Append-only audit of referral attribution decisions. Service-role only (RLS on, no policies). Written by lib/attribution-log.ts.';

-- Commission disputes are always scoped to one agent over a date range.
create index if not exists referral_attribution_events_agent_created_idx
  on public.referral_attribution_events (agent_id, created_at desc);

-- "Which agent was this researcher credited to, and why?" -- the other axis.
create index if not exists referral_attribution_events_user_idx
  on public.referral_attribution_events (user_id)
  where user_id is not null;

alter table public.referral_attribution_events enable row level security;

-- Deliberately no policies. Deny-by-default is the intended access model;
-- the admin/service-role client bypasses RLS.

revoke all on public.referral_attribution_events from anon, authenticated;
revoke all on sequence public.referral_attribution_events_id_seq from anon, authenticated;
