-- Round 25 P0 hotfix — add buyer-side payment handles JSONB to profiles
-- (agent_profiles.payment_handles is unrelated; that holds the agent's
--  storefront methods. This column stores the buyer's saved handle/contact
--  for each method slug so checkout can pre-fill what the buyer sends to
--  the agent.)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS payment_handles JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.profiles.payment_handles IS
  'Per-method buyer handle/contact map keyed by payment method slug (zelle, venmo, cashapp, apple_pay, apple_cash, paypal, google_wallet, wise, chime).';
