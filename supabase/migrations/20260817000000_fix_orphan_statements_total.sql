-- Fix any open statements that have a > $0 total_owed but ZERO orders attached to them.
-- These "orphan statements" happen when all orders in a statement are cancelled or deleted, 
-- but the weekly_statement header is left behind with a non-zero total_owed.
-- Previously, the hygiene script only cleaned up open statements with exactly total_owed = 0.

UPDATE public.weekly_statements
SET status = 'paid', payment_reference = 'Auto-closed: no active orders', paid_at = now()
WHERE status = 'open'
  AND NOT EXISTS (SELECT 1 FROM public.statement_orders so WHERE so.statement_id = weekly_statements.id);
