-- ============================================================================
-- 20260723113000_forge_paid_by_agent.sql
--
-- EasyPost Forge follow-up: labels bought through an agent's own white-label
-- EasyPost sub-account are paid by the AGENT's card at EasyPost, not by the
-- platform. The original shipping ledger CHECK constraints only allowed
-- ('platform','agent_byo') / ('platform','agent_byo','manual'), so the new
-- 'agent' value used by lib/shipping.ts (key.source === 'agent_forge') would
-- be rejected. Relax both constraints to include 'agent'.
-- ============================================================================

ALTER TABLE public.shipping_label_purchases
  DROP CONSTRAINT IF EXISTS shipping_label_purchases_paid_by_check;
ALTER TABLE public.shipping_label_purchases
  ADD CONSTRAINT shipping_label_purchases_paid_by_check
  CHECK (paid_by IN ('platform', 'agent_byo', 'agent'));

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_shipping_paid_by_check;
ALTER TABLE public.orders
  ADD CONSTRAINT orders_shipping_paid_by_check
  CHECK (shipping_paid_by IS NULL OR shipping_paid_by IN ('platform', 'agent_byo', 'manual', 'agent'));

COMMENT ON COLUMN public.shipping_label_purchases.paid_by IS
  'platform = platform EasyPost account paid; agent_byo = agent bought outside the portal (paste-back); agent = agent''s own EasyPost Forge sub-account wallet paid.';
