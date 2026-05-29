CREATE TABLE IF NOT EXISTS public.rma_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  requester_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  reason_category TEXT NOT NULL CHECK (reason_category IN ('damaged','wrong_item','quality_issue','not_as_described','other')),
  reason_details TEXT NOT NULL,
  requested_resolution TEXT NOT NULL DEFAULT 'refund' CHECK (requested_resolution IN ('refund','store_credit','replacement')),
  status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','approved','label_sent','in_transit','received','inspected','resolved','rejected')),
  approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  rejected_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  rejected_at TIMESTAMPTZ,
  rejected_reason TEXT,
  return_label_url TEXT,
  return_tracking_number TEXT,
  return_label_purchased_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ,
  inspected_at TIMESTAMPTZ,
  inspected_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  inspection_notes TEXT,
  restock_decision TEXT CHECK (restock_decision IN ('restock','dispose','quarantine','vendor_return')),
  resolution_type TEXT CHECK (resolution_type IN ('refund_full','refund_partial','store_credit_full','store_credit_partial','replacement_sent','no_action')),
  resolution_refund_id UUID,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS rma_requests_order_idx ON public.rma_requests(order_id);
CREATE INDEX IF NOT EXISTS rma_requests_requester_idx ON public.rma_requests(requester_id, created_at DESC);
CREATE INDEX IF NOT EXISTS rma_requests_status_idx ON public.rma_requests(status, created_at DESC);
ALTER TABLE public.rma_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Buyer sees own RMAs" ON public.rma_requests;
CREATE POLICY "Buyer sees own RMAs" ON public.rma_requests FOR SELECT
  USING (requester_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.orders o WHERE o.id = rma_requests.order_id AND o.buyer_id = auth.uid()));
DROP POLICY IF EXISTS "Buyer creates own RMAs" ON public.rma_requests;
CREATE POLICY "Buyer creates own RMAs" ON public.rma_requests FOR INSERT
  WITH CHECK (requester_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.buyer_id = auth.uid()));
DROP POLICY IF EXISTS "Agent sees order RMAs" ON public.rma_requests;
CREATE POLICY "Agent sees order RMAs" ON public.rma_requests FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = rma_requests.order_id
    AND (o.agent_id = auth.uid()
         OR (SELECT parent_agent_id FROM public.profiles WHERE id = o.agent_id) = auth.uid())));
DROP POLICY IF EXISTS "Agent updates order RMAs" ON public.rma_requests;
CREATE POLICY "Agent updates order RMAs" ON public.rma_requests FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = rma_requests.order_id
    AND (o.agent_id = auth.uid()
         OR (SELECT parent_agent_id FROM public.profiles WHERE id = o.agent_id) = auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = rma_requests.order_id
    AND (o.agent_id = auth.uid()
         OR (SELECT parent_agent_id FROM public.profiles WHERE id = o.agent_id) = auth.uid())));
DROP POLICY IF EXISTS "Admin manages all RMAs" ON public.rma_requests;
CREATE POLICY "Admin manages all RMAs" ON public.rma_requests FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE TABLE IF NOT EXISTS public.rma_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rma_id UUID NOT NULL REFERENCES public.rma_requests(id) ON DELETE CASCADE,
  order_item_id UUID REFERENCES public.order_items(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_amount NUMERIC NOT NULL CHECK (unit_amount >= 0),
  condition_received TEXT CHECK (condition_received IN ('unopened','damaged','tampered','partial','as_expected'))
);
CREATE INDEX IF NOT EXISTS rma_items_rma_idx ON public.rma_items(rma_id);
ALTER TABLE public.rma_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "RMA items follow parent" ON public.rma_items;
CREATE POLICY "RMA items follow parent" ON public.rma_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.rma_requests r WHERE r.id = rma_items.rma_id));
DROP POLICY IF EXISTS "Admin manages rma items" ON public.rma_items;
CREATE POLICY "Admin manages rma items" ON public.rma_items FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE TABLE IF NOT EXISTS public.rma_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rma_id UUID NOT NULL REFERENCES public.rma_requests(id) ON DELETE CASCADE,
  uploader_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  storage_key TEXT NOT NULL,
  mime_type TEXT,
  size_bytes INTEGER,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS rma_attachments_rma_idx ON public.rma_attachments(rma_id);
ALTER TABLE public.rma_attachments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Attachments follow parent" ON public.rma_attachments;
CREATE POLICY "Attachments follow parent" ON public.rma_attachments FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.rma_requests r WHERE r.id = rma_attachments.rma_id));
DROP POLICY IF EXISTS "Uploader inserts attachments" ON public.rma_attachments;
CREATE POLICY "Uploader inserts attachments" ON public.rma_attachments FOR INSERT
  WITH CHECK (uploader_id = auth.uid());
DROP POLICY IF EXISTS "Admin manages attachments" ON public.rma_attachments;
CREATE POLICY "Admin manages attachments" ON public.rma_attachments FOR ALL
  USING (public.is_admin()) WITH CHECK (public.is_admin());

INSERT INTO storage.buckets (id, name, public)
VALUES ('rma-attachments', 'rma-attachments', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "rma_attachments_buyer_insert" ON storage.objects;
CREATE POLICY "rma_attachments_buyer_insert" ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'rma-attachments'
    AND (storage.foldername(name))[1]::uuid IN (
      SELECT id FROM public.rma_requests WHERE requester_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "rma_attachments_select" ON storage.objects;
CREATE POLICY "rma_attachments_select" ON storage.objects FOR SELECT
  USING (
    bucket_id = 'rma-attachments'
    AND (
      public.is_admin()
      OR (storage.foldername(name))[1]::uuid IN (
        SELECT r.id FROM public.rma_requests r WHERE r.requester_id = auth.uid()
      )
      OR (storage.foldername(name))[1]::uuid IN (
        SELECT r.id FROM public.rma_requests r
        JOIN public.orders o ON o.id = r.order_id
        WHERE o.agent_id = auth.uid()
           OR (SELECT parent_agent_id FROM public.profiles WHERE id = o.agent_id) = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "rma_attachments_admin_delete" ON storage.objects;
CREATE POLICY "rma_attachments_admin_delete" ON storage.objects FOR DELETE
  USING (bucket_id = 'rma-attachments' AND public.is_admin());
