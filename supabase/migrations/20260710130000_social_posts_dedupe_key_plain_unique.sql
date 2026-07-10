-- The dedupe_key unique index was PARTIAL (WHERE dedupe_key IS NOT NULL).
-- Postgres will not match `ON CONFLICT (dedupe_key)` to a partial index without
-- repeating the predicate, so the generator's idempotent batch upsert
-- (/api/social/ingest) failed outright.
--
-- A plain unique index behaves identically for our purposes: NULLs are always
-- distinct in a Postgres unique index, so any number of rows may still carry a
-- NULL dedupe_key (manual/admin enqueues), while ON CONFLICT (dedupe_key) now
-- resolves correctly and makes re-running the monthly generator idempotent.
drop index if exists public.social_posts_dedupe_key_uidx;

create unique index if not exists social_posts_dedupe_key_uidx
  on public.social_posts (dedupe_key);
