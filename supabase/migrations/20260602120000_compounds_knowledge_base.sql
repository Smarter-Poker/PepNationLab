-- Peptide Expert knowledge base: one row per distinct compound.
-- Products (incl. dose/size variants) link to a compound via products.compound_slug.
-- Backbone for detail pages, evidence badges, faceted search, risk audit,
-- cart warnings, reconstitution + shelf-life, stacks, comparison, glossary.

create table if not exists public.compounds (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  display_name text not null,
  aliases text[] not null default '{}',
  category text,
  -- evidence_tier: approved_drug | investigational | preclinical | research_chemical | cosmetic | supply
  evidence_tier text not null default 'research_chemical',
  compound_class text,
  molecular_target text,
  -- identity: { sequence, molecular_weight, cas, parent }
  identity jsonb not null default '{}'::jsonb,
  mechanism text,
  studied_for text[] not null default '{}',
  -- research_areas (navigator facets): tissue_repair, metabolic, longevity, cosmetic,
  -- cognitive, immune, sexual_health, performance, sleep, healing, mitochondrial
  research_areas text[] not null default '{}',
  benefits text,
  side_effects text,
  warnings text,
  -- handling: { form, diluent, storage_temp, light_sensitive, freeze_thaw, reconstituted_days, notes }
  handling jsonb not null default '{}'::jsonb,
  regulatory text,
  -- wada_status: prohibited | prohibited_males | permitted | not_listed
  wada_status text not null default 'not_listed',
  sources text[] not null default '{}',
  plain_summary text,
  -- structured flags powering warnings / merchandising
  is_temp_sensitive boolean not null default false,
  is_pro_angiogenic boolean not null default false,
  is_glp1 boolean not null default false,
  is_stack boolean not null default false,
  stack_components text[] not null default '{}',
  stack_rationale text,
  -- catalog-risk audit
  -- risk_level: low | moderate | high | critical
  risk_level text not null default 'low',
  risk_reasons text[] not null default '{}',
  -- recommended_action: keep | review | restrict | remove
  recommended_action text not null default 'keep',
  reconstitution_shelf_days integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint compounds_evidence_tier_chk check (evidence_tier in
    ('approved_drug','investigational','preclinical','research_chemical','cosmetic','supply')),
  constraint compounds_wada_chk check (wada_status in
    ('prohibited','prohibited_males','permitted','not_listed')),
  constraint compounds_risk_chk check (risk_level in ('low','moderate','high','critical')),
  constraint compounds_action_chk check (recommended_action in ('keep','review','restrict','remove'))
);

create index if not exists compounds_category_idx on public.compounds (category);
create index if not exists compounds_evidence_tier_idx on public.compounds (evidence_tier);
create index if not exists compounds_risk_level_idx on public.compounds (risk_level);
create index if not exists compounds_research_areas_idx on public.compounds using gin (research_areas);
create index if not exists compounds_aliases_idx on public.compounds using gin (aliases);

-- Link products to their canonical compound.
alter table public.products add column if not exists compound_slug text;
create index if not exists products_compound_slug_idx on public.products (compound_slug);

-- updated_at trigger
create or replace function public.compounds_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

drop trigger if exists compounds_updated_at on public.compounds;
create trigger compounds_updated_at before update on public.compounds
  for each row execute function public.compounds_set_updated_at();

-- RLS: compounds are reference content shown on public storefronts -> readable by
-- anon + authenticated; writes restricted to admins.
alter table public.compounds enable row level security;

drop policy if exists compounds_public_read on public.compounds;
create policy compounds_public_read on public.compounds
  for select using (true);

drop policy if exists compounds_admin_write on public.compounds;
create policy compounds_admin_write on public.compounds
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

comment on table public.compounds is 'Peptide Expert knowledge base: one canonical row per distinct catalog compound. Research-use-only factual reference. Products link via products.compound_slug.';
