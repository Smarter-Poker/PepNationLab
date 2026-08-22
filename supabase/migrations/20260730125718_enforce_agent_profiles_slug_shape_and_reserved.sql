-- Storefront slugs are routed by the edge middleware (proxy.ts). A slug that
-- the middleware's matcher rejects, or that collides with a real app route,
-- produces a storefront that is PERMANENTLY unreachable: the QR code is
-- generated, the agent hands it out, and every scan silently lands somewhere
-- else. There are five separate creation paths and they disagreed on the
-- allowed shape, so enforce it once here where nothing can bypass it.
--
-- Mirrors lib/store-slug.ts (STORE_SLUG_RE + RESERVED_SEGMENTS). The database
-- is the authoritative enforcement point; the TS module exists so the UI can
-- give a friendly message before the insert is attempted.
--
-- Verified before applying: all 60 live rows already satisfy both rules
-- (0 bad shape, 0 reserved, 0 null), so this is non-breaking.

alter table public.agent_profiles
  drop constraint if exists agent_profiles_slug_shape;

alter table public.agent_profiles
  add constraint agent_profiles_slug_shape
  check (slug ~ '^[a-z0-9][a-z0-9_-]{1,49}$')
  not valid;

alter table public.agent_profiles
  validate constraint agent_profiles_slug_shape;

create or replace function public.agent_profiles_slug_not_reserved()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  reserved constant text[] := array[
    'about','accept-disclaimer','account','admin','advertising','api','auth',
    'become-agent','checkout','coa','compliance','contact','dashboard',
    'disclaimer','favicon.ico','feed.xml','find-a-peptide','forgot-password',
    'help','invite','lab-journal','lab-tools','llms.txt','llms-full.txt',
    'login','manifest.webmanifest','messages','messenger','onboarding',
    'orders','peptide-101','peptides','privacy','products','register',
    'research','reset-password','robots.txt','shelf-life','shipping',
    'signup','sitemap.xml','status','sw.js','terms','wallet','_next'
  ];
begin
  new.slug := lower(btrim(coalesce(new.slug, '')));

  if new.slug = any (reserved) then
    raise exception 'Storefront URL "%" is reserved by the site.', new.slug
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_agent_profiles_slug_not_reserved on public.agent_profiles;

create trigger trg_agent_profiles_slug_not_reserved
  before insert or update of slug on public.agent_profiles
  for each row
  execute function public.agent_profiles_slug_not_reserved();
