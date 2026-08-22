-- ============================================================================
-- Order Notifications And Staleness Escalation Upgrade (2026-07-19)
--
-- 1. order_events: unified per-order timeline / audit feed. Every meaningful
--    lifecycle moment (placed, payment confirmed, approved, forwarded,
--    cancelled, shipped, delivered, reminders, escalations) is appended here
--    by the app layer via the service role. Powers the order timeline UI and
--    gives disputes a single authoritative history.
-- 2. orders payment-confirmation stamps: who verified the peer-to-peer
--    payment and when (Mark Paid previously left no evidence).
-- 3. Buyer payment-reminder tracking + agent staleness-escalation tracking
--    columns, consumed by the rebuilt /api/cron/reminders job.
-- 4. PLATFORM RULE CHANGE: orders are NEVER cancelled automatically.
--    cancel_stale_pending_orders is neutralized to a no-op (kept for
--    signature compatibility). Staleness now escalates to the agent, their
--    upline, and admins instead of destroying the order.
-- ============================================================================

-- 1. order_events -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.order_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  event text NOT NULL,
  actor_id uuid NULL,
  actor_role text NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_order_events_order
  ON public.order_events(order_id, created_at);

ALTER TABLE public.order_events ENABLE ROW LEVEL SECURITY;

-- Read access: the order's buyer, its agent of record, that agent's parent
-- (super agent), and admins. Writes are service-role only (no policies).
DROP POLICY IF EXISTS order_events_select ON public.order_events;
CREATE POLICY order_events_select ON public.order_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.orders o
      LEFT JOIN public.profiles ap ON ap.id = o.agent_id
      WHERE o.id = order_events.order_id
        AND (
          o.buyer_id = auth.uid()
          OR o.agent_id = auth.uid()
          OR ap.parent_agent_id = auth.uid()
        )
    )
    OR public.is_admin()
  );

-- 2 + 3. orders columns -----------------------------------------------------
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS payment_confirmed_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS payment_confirmed_by uuid NULL,
  ADD COLUMN IF NOT EXISTS payment_reminder_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_payment_reminder_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS stale_escalation_level integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_stale_escalation_at timestamptz NULL;

-- Fast scan for the reminder/escalation cron: only rows still awaiting action.
CREATE INDEX IF NOT EXISTS idx_orders_awaiting_action
  ON public.orders(status, created_at)
  WHERE status IN ('pending_customer_payment', 'agent_approval_pending', 'admin_approval_pending');

-- 4. Neutralize the auto-cancel sweep ---------------------------------------
-- Orders must NEVER be auto-cancelled. The function is kept (same signature
-- incl. DEFAULT 72) so any residual caller gets a harmless 0 instead of an
-- error, but it no longer touches a single row. Manual cancels (agent/admin
-- via cancel_order) are unaffected.
CREATE OR REPLACE FUNCTION public.cancel_stale_pending_orders(p_hours integer DEFAULT 72)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Platform rule (2026-07-19): no automatic order cancellation, ever.
  -- Staleness is handled by the escalation cron (/api/cron/reminders), which
  -- alerts the agent, their upline, and admins instead of cancelling.
  RETURN 0;
END;
$$;
