-- R26 migration: lot + COA placeholders on order_items, low-stock threshold
-- on agent_inventory, and a 'low_stock' value on notifications.type.

-- 1) order_items: per-line lot + COA fields. User wires actual values later.
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS lot_number TEXT,
  ADD COLUMN IF NOT EXISTS coa_url    TEXT;

COMMENT ON COLUMN public.order_items.lot_number IS
  'Lot/batch number for this specific line item. Stamped at fulfillment time.';
COMMENT ON COLUMN public.order_items.coa_url IS
  'URL to the Certificate of Analysis for the lot above. Public read once shipped.';

-- 2) agent_inventory: per-row low-stock threshold so agents can tune
ALTER TABLE public.agent_inventory
  ADD COLUMN IF NOT EXISTS low_stock_threshold INTEGER NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS low_stock_alerted_at TIMESTAMPTZ;

COMMENT ON COLUMN public.agent_inventory.low_stock_threshold IS
  'Cron fires a low_stock notification when stock_count <= this value. Default 5.';
COMMENT ON COLUMN public.agent_inventory.low_stock_alerted_at IS
  'When the most recent low-stock alert was sent for this row. Cron throttles to one alert per 24h per row.';

-- 3) notifications: extend the type CHECK constraint to include 'low_stock'
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'order_placed', 'order_approved', 'order_shipped', 'order_delivered',
    'order_cancelled', 'commission_earned', 'new_researcher', 'new_message',
    'invoice', 'payment_reminder', 'cart_reminder', 'referral', 'system',
    'low_stock'
  ));
