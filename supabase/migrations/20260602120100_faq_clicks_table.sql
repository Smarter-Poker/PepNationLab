-- R28 — FAQ click analytics
--
-- Anonymous click-through counter so we can see which FAQ items get
-- opened most. Rows are written by /api/analytics/faq-click via the
-- service-role client; no public INSERT / SELECT — only admin reads.

CREATE TABLE IF NOT EXISTS public.faq_clicks (
  id           BIGSERIAL PRIMARY KEY,
  faq_id       TEXT      NOT NULL,
  source       TEXT,
  user_role    TEXT,
  user_id      UUID,
  ip_hash      TEXT,
  user_agent   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS faq_clicks_faq_id_created_idx
  ON public.faq_clicks (faq_id, created_at DESC);

CREATE INDEX IF NOT EXISTS faq_clicks_source_idx
  ON public.faq_clicks (source) WHERE source IS NOT NULL;

ALTER TABLE public.faq_clicks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS faq_clicks_admin_read ON public.faq_clicks;
CREATE POLICY faq_clicks_admin_read
  ON public.faq_clicks
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

COMMENT ON TABLE  public.faq_clicks IS 'R28: anonymous FAQ click-through counter, written via service-role endpoint';
COMMENT ON COLUMN public.faq_clicks.faq_id     IS 'kebab-case id from lib/help-faq.ts';
COMMENT ON COLUMN public.faq_clicks.source     IS 'optional surface label, e.g. order-detail, checkout, wallet';
COMMENT ON COLUMN public.faq_clicks.ip_hash    IS 'SHA-256 of (ip || daily_salt) — never the raw IP';
