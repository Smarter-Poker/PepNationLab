-- Reconstitution + shelf-life tracker: a researcher logs when they reconstituted
-- a vial; the app shows remaining shelf life (from the compound handling data)
-- and nudges a re-order near expiry. Research/lab-prep tracking only.
create table if not exists public.reconstitution_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  compound_slug text not null,
  product_id uuid,
  label text,
  reconstituted_on date not null default current_date,
  shelf_days integer not null default 28,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists reconstitution_logs_user_idx on public.reconstitution_logs (user_id, reconstituted_on desc);

alter table public.reconstitution_logs enable row level security;

drop policy if exists reconstitution_logs_owner_sel on public.reconstitution_logs;
create policy reconstitution_logs_owner_sel on public.reconstitution_logs
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists reconstitution_logs_owner_ins on public.reconstitution_logs;
create policy reconstitution_logs_owner_ins on public.reconstitution_logs
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists reconstitution_logs_owner_upd on public.reconstitution_logs;
create policy reconstitution_logs_owner_upd on public.reconstitution_logs
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists reconstitution_logs_owner_del on public.reconstitution_logs;
create policy reconstitution_logs_owner_del on public.reconstitution_logs
  for delete to authenticated using (auth.uid() = user_id);

comment on table public.reconstitution_logs is 'Researcher-logged reconstitution dates for the shelf-life tracker. Owner-scoped RLS.';
