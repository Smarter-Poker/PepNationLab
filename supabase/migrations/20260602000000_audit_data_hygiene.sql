-- Audit 2026-06-02 — data hygiene pass.
--
-- 1) profiles.email — collapse empty strings to NULL so identity lookups,
--    password reset, and lower(email) dedupe work correctly. Then forbid
--    empty-string going forward via a CHECK constraint.
-- 2) Mark 3 zero-owed orphan weekly_statements as paid so they stop
--    clogging the agent + admin "Open Statements" lists.
-- 3) Cancel 6 orders that have no line items (orphaned by a prior delete
--    or interrupted insert). Refund nothing since none of them have a
--    matching balance_transactions row.
-- 4) Sweep pending_customer_payment orders older than 72h via the existing
--    cancel_stale_pending_orders RPC (no cron was scheduled for it).

UPDATE public.profiles SET email = NULL WHERE email = '';

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_email_not_blank,
  ADD  CONSTRAINT profiles_email_not_blank
       CHECK (email IS NULL OR length(btrim(email)) > 0);

UPDATE public.weekly_statements
SET    status = 'paid',
       paid_at = now(),
       payment_method = 'auto_pay'
WHERE  total_owed = 0
  AND  status IN ('open', 'pending_payment')
  AND  NOT EXISTS (SELECT 1 FROM public.statement_orders so WHERE so.statement_id = weekly_statements.id);

UPDATE public.orders
SET    status = 'cancelled',
       cancellation_reason = COALESCE(cancellation_reason, 'auto: order has no line items (data hygiene 2026-06-02)')
WHERE  status <> 'cancelled'
  AND  NOT EXISTS (SELECT 1 FROM public.order_items oi WHERE oi.order_id = orders.id);

SELECT public.cancel_stale_pending_orders(72);
