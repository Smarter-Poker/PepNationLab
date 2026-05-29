-- Agent Invitations: token-based onboarding for new agents / super_agents.
--
-- Admins (and super_agents, scoped to their own sub-agents) can mint a one-time
-- token that grants the recipient the ability to set their password and create
-- an account with the pre-decided role, tier, and account type. Invites expire
-- after 14 days by default. Revoking an invite simply marks redeemed_at NOW()
-- with metadata.revoked = true; the unique partial index ensures the same
-- token cannot be redeemed twice.
--
-- Redemption itself runs through the public `/api/agent-invitations/redeem`
-- route (rate-limited, service-role insert) — there is no SELECT policy for
-- redemption because the route uses the service-role client.

CREATE TABLE IF NOT EXISTS public.agent_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  full_name TEXT,
  intended_role TEXT NOT NULL DEFAULT 'agent' CHECK (intended_role IN ('agent','super_agent')),
  intended_tier TEXT CHECK (intended_tier IN ('tier_1','tier_2','tier_3')),
  intended_account_type TEXT CHECK (intended_account_type IN ('credit','prepaid')),
  intended_credit_limit NUMERIC,
  intended_prepaid_balance NUMERIC,
  parent_agent_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  invited_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '14 days'),
  redeemed_at TIMESTAMPTZ,
  redeemed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS agent_invitations_token_idx ON public.agent_invitations(token) WHERE redeemed_at IS NULL;
CREATE INDEX IF NOT EXISTS agent_invitations_invited_by_idx ON public.agent_invitations(invited_by, created_at DESC);

ALTER TABLE public.agent_invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin manage all invites" ON public.agent_invitations;
CREATE POLICY "Admin manage all invites" ON public.agent_invitations
  FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Super agent manage own invites" ON public.agent_invitations;
CREATE POLICY "Super agent manage own invites" ON public.agent_invitations
  FOR ALL
  USING (public.is_super_agent() AND invited_by = auth.uid())
  WITH CHECK (public.is_super_agent() AND invited_by = auth.uid() AND intended_role = 'agent');
