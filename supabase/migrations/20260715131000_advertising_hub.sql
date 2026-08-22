-- Advertising Hub: central marketing asset library.
-- Admin and agents upload flyers/ads; all agent-type accounts browse and
-- download them for reuse on their own platforms.
-- Applied to ydsaqnnuwyvtyxgvrnys via Supabase MCP on 2026-07-15.

create table if not exists public.advertising_assets (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  category text not null default 'Flyer',
  peptide_name text,
  peptide_slug text,
  file_path text not null,
  file_url text not null,
  file_type text,
  file_size bigint,
  uploaded_by uuid references public.profiles(id) on delete set null,
  uploader_name text,
  download_count integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.advertising_assets is 'Advertising Hub asset library: flyers/ads uploaded by admin and agents, downloadable by every agent-type account for reuse across their own marketing channels.';

create index if not exists idx_advertising_assets_category on public.advertising_assets (category);
create index if not exists idx_advertising_assets_peptide on public.advertising_assets (peptide_slug);
create index if not exists idx_advertising_assets_created on public.advertising_assets (created_at desc);

alter table public.advertising_assets enable row level security;

drop policy if exists "advertising_assets_select" on public.advertising_assets;
create policy "advertising_assets_select" on public.advertising_assets
  for select using (public.is_agent_or_above());

drop policy if exists "advertising_assets_insert" on public.advertising_assets;
create policy "advertising_assets_insert" on public.advertising_assets
  for insert with check (public.is_agent_or_above() and uploaded_by = auth.uid());

drop policy if exists "advertising_assets_update" on public.advertising_assets;
create policy "advertising_assets_update" on public.advertising_assets
  for update using (public.is_admin() or uploaded_by = auth.uid())
  with check (public.is_admin() or uploaded_by = auth.uid());

drop policy if exists "advertising_assets_delete" on public.advertising_assets;
create policy "advertising_assets_delete" on public.advertising_assets
  for delete using (public.is_admin() or uploaded_by = auth.uid());

-- Keep updated_at fresh on edits.
create or replace function public.advertising_assets_set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end
$$;

drop trigger if exists trg_advertising_assets_updated on public.advertising_assets;
create trigger trg_advertising_assets_updated
  before update on public.advertising_assets
  for each row execute function public.advertising_assets_set_updated_at();

-- Download counter. SECURITY DEFINER so any agent-type can bump the count
-- without holding an UPDATE policy on the row.
create or replace function public.increment_advertising_download(p_asset_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.advertising_assets
     set download_count = download_count + 1
   where id = p_asset_id
     and public.is_agent_or_above();
$$;

revoke all on function public.increment_advertising_download(uuid) from public;
grant execute on function public.increment_advertising_download(uuid) to authenticated;

-- Public storage bucket for the creatives themselves. Marketing files are
-- meant to be redistributed, so public read is intentional.
insert into storage.buckets (id, name, public)
values ('advertising', 'advertising', true)
on conflict (id) do nothing;

drop policy if exists "advertising_storage_read" on storage.objects;
create policy "advertising_storage_read" on storage.objects
  for select using (bucket_id = 'advertising');

drop policy if exists "advertising_storage_insert" on storage.objects;
create policy "advertising_storage_insert" on storage.objects
  for insert with check (bucket_id = 'advertising' and public.is_agent_or_above());

drop policy if exists "advertising_storage_update" on storage.objects;
create policy "advertising_storage_update" on storage.objects
  for update using (bucket_id = 'advertising' and (public.is_admin() or owner_id = (select auth.uid())::text));

drop policy if exists "advertising_storage_delete" on storage.objects;
create policy "advertising_storage_delete" on storage.objects
  for delete using (bucket_id = 'advertising' and (public.is_admin() or owner_id = (select auth.uid())::text));
