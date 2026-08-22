-- ============================================================
-- Varo Payment Method: DB-Side Enum Alignment
-- ============================================================
-- Commit a59bbbce added Varo to every application-layer payment list
-- (account payment methods, wallet, orders route Zod schema) but missed
-- the two database-side value lists. Without this migration:
--
--   1. PUT /api/account/payment-method with default_payment_method='varo'
--      passes Zod but violates profiles_default_payment_method_check
--      and returns a 500.
--   2. Any order INSERT/UPDATE with payment_method='varo' (accepted by
--      the orders route schema) fails with an invalid enum value error.
--
-- Applied to ydsaqnnuwyvtyxgvrnys via Supabase MCP.

-- 1. Add 'varo' to the payment_method enum used by orders.payment_method.
ALTER TYPE public.payment_method ADD VALUE IF NOT EXISTS 'varo';

-- 2. Recreate the profiles default-payment-method check with the full
--    10-method list (it previously stopped at 'chime').
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_default_payment_method_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_default_payment_method_check
  CHECK (
    default_payment_method IS NULL
    OR default_payment_method = ANY (ARRAY[
      'zelle'::text,
      'cashapp'::text,
      'venmo'::text,
      'apple_pay'::text,
      'apple_cash'::text,
      'paypal'::text,
      'google_wallet'::text,
      'wise'::text,
      'chime'::text,
      'varo'::text
    ])
  );
