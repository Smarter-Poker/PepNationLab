-- ============================================================
-- Sweep 16: Fix store_credits.type CHECK constraint
-- ============================================================
-- The store_credits table was created with:
--   type TEXT NOT NULL CHECK (type IN ('issue','redeem','expire','adjustment'))
--
-- But checkout_atomicity (20260602000001) added release_store_credit() which
-- INSERTs with type = 'release'. This means any checkout rollback that calls
-- release_store_credit() fails with a Postgres CHECK constraint violation,
-- permanently losing the user's store credit with no recovery path.
--
-- Similarly, audit15_security_hardening redefined redeem_store_credit() using
-- the 3-arg overload (without description) which inserts with type = 'redeem'
-- (which is already allowed), but the constraint should also explicitly allow
-- 'release' for the compensating path.
--
-- Fix: replace the CHECK constraint to allow all known types.
-- ============================================================

ALTER TABLE public.store_credits
  DROP CONSTRAINT IF EXISTS store_credits_type_check;

ALTER TABLE public.store_credits
  ADD CONSTRAINT store_credits_type_check
  CHECK (type IN ('issue', 'redeem', 'release', 'expire', 'adjustment', 'refund', 'credit'));

-- Also: audit15 re-defined redeem_store_credit with a 3-arg signature that
-- inserted into store_credits WITHOUT the source_order_id field (NULL).
-- The old 4-arg version that wrote source_order_id is still valid. The GRANT
-- below ensures both variants are callable by authenticated users.
GRANT EXECUTE ON FUNCTION public.redeem_store_credit(UUID, NUMERIC, UUID) TO authenticated;
