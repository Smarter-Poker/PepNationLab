-- Webhook endpoints registered by agents (or admin for the whole platform)
CREATE TABLE IF NOT EXISTS public.webhook_endpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_type TEXT NOT NULL CHECK (owner_type IN ('admin','agent')),
  owner_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  url TEXT NOT NULL CHECK (url ~ '^https://'),
  secret TEXT NOT NULL,
  event_types TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  is_active BOOLEAN NOT NULL DEFAULT true,
  failure_count INTEGER NOT NULL DEFAULT 0,
  last_failure_at TIMESTAMPTZ,
  last_failure_reason TEXT,
  last_success_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK ((owner_type = 'admin' AND owner_id IS NULL) OR (owner_type = 'agent' AND owner_id IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS webhook_endpoints_owner_idx ON public.webhook_endpoints(owner_type, owner_id);
ALTER TABLE public.webhook_endpoints ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Agent manages own webhook endpoints" ON public.webhook_endpoints;
CREATE POLICY "Agent manages own webhook endpoints" ON public.webhook_endpoints
  FOR ALL USING (owner_type = 'agent' AND owner_id = auth.uid())
  WITH CHECK (owner_type = 'agent' AND owner_id = auth.uid());

DROP POLICY IF EXISTS "Super agent reads downline webhook endpoints" ON public.webhook_endpoints;
CREATE POLICY "Super agent reads downline webhook endpoints" ON public.webhook_endpoints
  FOR SELECT USING (
    owner_type = 'agent'
    AND (SELECT parent_agent_id FROM public.profiles WHERE id = owner_id) = auth.uid()
  );

DROP POLICY IF EXISTS "Admin manages all webhook endpoints" ON public.webhook_endpoints;
CREATE POLICY "Admin manages all webhook endpoints" ON public.webhook_endpoints
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Delivery queue + audit log
CREATE TABLE IF NOT EXISTS public.webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint_id UUID NOT NULL REFERENCES public.webhook_endpoints(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  related_order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','failed','expired')),
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_status_code INTEGER,
  last_response_body TEXT,
  last_attempted_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS webhook_deliveries_pending_idx ON public.webhook_deliveries(next_attempt_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS webhook_deliveries_endpoint_idx ON public.webhook_deliveries(endpoint_id, created_at DESC);
ALTER TABLE public.webhook_deliveries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Agent reads own deliveries" ON public.webhook_deliveries;
CREATE POLICY "Agent reads own deliveries" ON public.webhook_deliveries
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.webhook_endpoints e WHERE e.id = webhook_deliveries.endpoint_id AND e.owner_id = auth.uid()));

DROP POLICY IF EXISTS "Admin manages all deliveries" ON public.webhook_deliveries;
CREATE POLICY "Admin manages all deliveries" ON public.webhook_deliveries
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
