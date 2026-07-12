-- Flash sales: site-wide time-boxed retail discount with storefront banner.
-- NOTE: Applied to production 2026-07-11 via MCP before this file existed;
-- recovered here so the repo matches prod (CLAUDE.md "commit the migration
-- file" rule). Fully idempotent so a rebuild from migrations is safe.
CREATE TABLE IF NOT EXISTS public.flash_sales (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  banner_text  TEXT,
  discount_pct NUMERIC NOT NULL DEFAULT 0,
  starts_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ends_at      TIMESTAMPTZ NOT NULL,
  is_active    BOOLEAN NOT NULL DEFAULT FALSE,
  created_by   UUID,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.flash_sales ENABLE ROW LEVEL SECURITY;

-- Storefront banner + checkout read the currently-running sale directly with
-- the anon/session client; only rows inside their window are visible.
DROP POLICY IF EXISTS flash_sales_public_read_active ON public.flash_sales;
CREATE POLICY flash_sales_public_read_active ON public.flash_sales
  FOR SELECT TO anon, authenticated
  USING (is_active = TRUE AND starts_at <= NOW() AND ends_at >= NOW());

-- Admin CRUD goes through /api/admin/flash-sales (service role bypasses RLS);
-- this policy additionally allows direct admin-session access.
DROP POLICY IF EXISTS flash_sales_admin_write ON public.flash_sales;
CREATE POLICY flash_sales_admin_write ON public.flash_sales
  FOR ALL TO authenticated
  USING ((SELECT is_admin()))
  WITH CHECK ((SELECT is_admin()));
