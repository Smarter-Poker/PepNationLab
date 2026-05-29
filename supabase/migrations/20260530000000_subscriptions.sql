-- Subscriptions / Auto-Replenish Orders
-- Tables: subscriptions, subscription_runs
-- See app/api/cron/subscriptions-process for the hourly processor.

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  researcher_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','cancelled')),
  cadence_days INTEGER NOT NULL CHECK (cadence_days BETWEEN 7 AND 365),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('zelle','cashapp','venmo','apple_pay')),
  fulfillment_method TEXT NOT NULL DEFAULT 'ship' CHECK (fulfillment_method IN ('ship','agent_pickup')),
  shipping_address JSONB,
  items_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
  next_run_at TIMESTAMPTZ NOT NULL,
  last_run_at TIMESTAMPTZ,
  last_order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  failure_count INTEGER NOT NULL DEFAULT 0,
  last_failure_reason TEXT,
  paused_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS subscriptions_due_idx ON public.subscriptions(next_run_at) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS subscriptions_researcher_idx ON public.subscriptions(researcher_id, status);
CREATE INDEX IF NOT EXISTS subscriptions_agent_idx ON public.subscriptions(agent_id, status);
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Researchers manage own subscriptions" ON public.subscriptions;
CREATE POLICY "Researchers manage own subscriptions" ON public.subscriptions
  FOR ALL USING (researcher_id = auth.uid()) WITH CHECK (researcher_id = auth.uid());

DROP POLICY IF EXISTS "Agent reads downline subscriptions" ON public.subscriptions;
CREATE POLICY "Agent reads downline subscriptions" ON public.subscriptions
  FOR SELECT USING (agent_id = auth.uid()
    OR (SELECT parent_agent_id FROM public.profiles WHERE id = agent_id) = auth.uid());

DROP POLICY IF EXISTS "Admins manage all subscriptions" ON public.subscriptions;
CREATE POLICY "Admins manage all subscriptions" ON public.subscriptions
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE TABLE IF NOT EXISTS public.subscription_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  run_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL CHECK (status IN ('succeeded','failed','skipped')),
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  failure_reason TEXT,
  notes TEXT
);
CREATE INDEX IF NOT EXISTS subscription_runs_sub_idx ON public.subscription_runs(subscription_id, run_at DESC);
ALTER TABLE public.subscription_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Researcher sees own runs" ON public.subscription_runs;
CREATE POLICY "Researcher sees own runs" ON public.subscription_runs FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.subscriptions s WHERE s.id = subscription_runs.subscription_id AND s.researcher_id = auth.uid()));

DROP POLICY IF EXISTS "Agent sees downline runs" ON public.subscription_runs;
CREATE POLICY "Agent sees downline runs" ON public.subscription_runs FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.subscriptions s WHERE s.id = subscription_runs.subscription_id
    AND (s.agent_id = auth.uid() OR (SELECT parent_agent_id FROM public.profiles WHERE id = s.agent_id) = auth.uid())));

DROP POLICY IF EXISTS "Admin sees all runs" ON public.subscription_runs;
CREATE POLICY "Admin sees all runs" ON public.subscription_runs FOR SELECT USING (public.is_admin());
