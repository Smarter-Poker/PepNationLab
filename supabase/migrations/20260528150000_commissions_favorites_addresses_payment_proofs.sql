-- =============================================================================
-- Phase 2 follow-on: commissions, payouts, favorites, saved addresses, payment proofs
-- Applied via Supabase MCP on 2026-05-28.
-- =============================================================================

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS commission_rate NUMERIC DEFAULT 15
  CHECK (commission_rate IS NULL OR (commission_rate >= 0 AND commission_rate <= 100));

CREATE TABLE IF NOT EXISTS public.agent_commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  commission_rate NUMERIC NOT NULL CHECK (commission_rate >= 0),
  order_subtotal NUMERIC NOT NULL CHECK (order_subtotal >= 0),
  commission_amount NUMERIC NOT NULL CHECK (commission_amount >= 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','paid','void')),
  approved_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  payout_id UUID,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (order_id)
);
CREATE INDEX IF NOT EXISTS agent_commissions_agent_id_idx ON public.agent_commissions(agent_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS agent_commissions_status_idx ON public.agent_commissions(status, created_at DESC);
CREATE INDEX IF NOT EXISTS agent_commissions_payout_id_idx ON public.agent_commissions(payout_id) WHERE payout_id IS NOT NULL;
ALTER TABLE public.agent_commissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage all commissions" ON public.agent_commissions
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Agents view own commissions" ON public.agent_commissions
  FOR SELECT USING (agent_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.payout_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL CHECK (amount >= 0),
  payment_method TEXT NOT NULL DEFAULT 'other',
  reference_number TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed','failed','reversed')),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS payout_records_agent_id_idx ON public.payout_records(agent_id, created_at DESC);
ALTER TABLE public.payout_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage all payouts" ON public.payout_records
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Agents view own payouts" ON public.payout_records
  FOR SELECT USING (agent_id = auth.uid());

ALTER TABLE public.agent_commissions
  DROP CONSTRAINT IF EXISTS agent_commissions_payout_id_fkey;
ALTER TABLE public.agent_commissions
  ADD CONSTRAINT agent_commissions_payout_id_fkey FOREIGN KEY (payout_id) REFERENCES public.payout_records(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.researcher_favorites (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, product_id)
);
CREATE INDEX IF NOT EXISTS researcher_favorites_user_idx ON public.researcher_favorites(user_id, created_at DESC);
ALTER TABLE public.researcher_favorites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own favorites" ON public.researcher_favorites
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.saved_addresses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  label TEXT,
  full_name TEXT NOT NULL,
  street1 TEXT NOT NULL,
  street2 TEXT,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  zip TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'US',
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS saved_addresses_user_idx ON public.saved_addresses(user_id, is_default DESC, updated_at DESC);
ALTER TABLE public.saved_addresses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own addresses" ON public.saved_addresses
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admins view all addresses" ON public.saved_addresses
  FOR SELECT USING (public.is_admin());

CREATE TABLE IF NOT EXISTS public.payment_proofs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  uploader_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  storage_key TEXT NOT NULL,
  mime_type TEXT,
  size_bytes INTEGER,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  verified_at TIMESTAMPTZ,
  verified_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS payment_proofs_order_idx ON public.payment_proofs(order_id);
ALTER TABLE public.payment_proofs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Buyer + Agent + Admin view proofs" ON public.payment_proofs
  FOR SELECT USING (
    uploader_id = auth.uid()
    OR public.is_admin()
    OR EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = payment_proofs.order_id
        AND (o.agent_id = auth.uid()
             OR (SELECT parent_agent_id FROM public.profiles WHERE id = o.agent_id) = auth.uid())
    )
  );
CREATE POLICY "Buyer upload proof" ON public.payment_proofs
  FOR INSERT WITH CHECK (
    uploader_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.buyer_id = auth.uid()
    )
  );
CREATE POLICY "Admin verify proof" ON public.payment_proofs
  FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());
