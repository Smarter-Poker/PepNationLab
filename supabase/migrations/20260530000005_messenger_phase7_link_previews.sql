-- ============================================================================
-- PepNationLab Messenger Phase 7 - link preview cache
-- Keyed by sha256(normalized URL) so the table is bounded regardless of URL length.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.messenger_link_previews (
  url_hash TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  title TEXT,
  description TEXT,
  image_url TEXT,
  host TEXT,
  fetched_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mlp_host ON public.messenger_link_previews (host);

ALTER TABLE public.messenger_link_previews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS mlp_select_authenticated ON public.messenger_link_previews;
CREATE POLICY mlp_select_authenticated ON public.messenger_link_previews FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS mlp_insert_authenticated ON public.messenger_link_previews;
CREATE POLICY mlp_insert_authenticated ON public.messenger_link_previews FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS mlp_update_authenticated ON public.messenger_link_previews;
CREATE POLICY mlp_update_authenticated ON public.messenger_link_previews FOR UPDATE TO authenticated USING (true);
