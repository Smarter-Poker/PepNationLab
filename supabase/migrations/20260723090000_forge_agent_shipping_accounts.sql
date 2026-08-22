-- ============================================================================
-- 20260723090000_forge_agent_shipping_accounts.sql
--
-- EasyPost Forge (ReferralCustomer white-label) agent shipping accounts.
--
-- Each agent gets their own white-label EasyPost sub-account with their own
-- card on file at EasyPost. Labels bought in the portal are paid by the
-- agent's EasyPost wallet; the platform never touches shipping money. The
-- referral production API key is encrypted at rest with the same AES-256-GCM
-- scheme as the platform credential (lib/shipping-crypto.ts,
-- SHIPPING_ENCRYPTION_KEY).
--
-- Gating: shipping_provider_credentials.forge_enabled (admin toggle) stays
-- false until the EasyPost partner (Forge) approval lands. All agent-facing
-- Forge routes no-op while it is false.
-- ============================================================================

-- Admin toggle on the platform credential row.
ALTER TABLE public.shipping_provider_credentials
  ADD COLUMN IF NOT EXISTS forge_enabled boolean NOT NULL DEFAULT false;

CREATE TABLE public.agent_shipping_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'easypost',

  -- EasyPost white-label user id (user_...).
  easypost_user_id text UNIQUE,

  -- Referral customer PRODUCTION API key, AES-256-GCM encrypted.
  api_key_ciphertext bytea,
  api_key_iv bytea,
  api_key_tag bytea,
  key_last4 text,

  -- Webhook registered on the referral account (hook_...), pointing at
  -- /api/webhooks/easypost with the shared HMAC secret.
  webhook_id text,

  -- pending_card: provisioned, no billing method yet.
  -- active: card on file, may buy labels.
  -- disabled: admin-disabled or deprovisioned.
  billing_status text NOT NULL DEFAULT 'pending_card'
    CHECK (billing_status IN ('pending_card', 'active', 'disabled')),
  card_brand text,
  card_last4 text,
  billing_added_at timestamptz,

  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_agent_shipping_accounts_agent ON public.agent_shipping_accounts(agent_id);

-- RLS: secrets live here, so NO direct client access at all. Every read and
-- write goes through service-role API routes that return only safe fields
-- (billing_status, card_last4, key_last4). Admin visibility is also served
-- through admin API routes with the service client.
ALTER TABLE public.agent_shipping_accounts ENABLE ROW LEVEL SECURITY;
-- Intentionally no policies: deny-all for anon/authenticated; the service
-- role bypasses RLS.

COMMENT ON TABLE public.agent_shipping_accounts IS
  'EasyPost Forge white-label sub-accounts per agent. Agent-paid shipping: card on file at EasyPost, wallet-billed labels. Encrypted referral API keys; service-role access only.';
