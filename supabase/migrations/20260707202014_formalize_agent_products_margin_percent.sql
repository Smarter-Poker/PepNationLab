-- Drift fix: agent_products.margin_percent exists in the production DB
-- (numeric NOT NULL DEFAULT 50.0 — verified via information_schema on
-- 2026-07-07) but was never introduced by any migration on disk. Triggers in
-- 20260701104400 / 20260701105000 reference NEW./OLD.margin_percent, so a
-- fresh rebuild from migrations would crash on every agent_products write.
-- This formalizes the column; IF NOT EXISTS makes it a no-op in prod.
ALTER TABLE public.agent_products
  ADD COLUMN IF NOT EXISTS margin_percent numeric NOT NULL DEFAULT 50.0;
