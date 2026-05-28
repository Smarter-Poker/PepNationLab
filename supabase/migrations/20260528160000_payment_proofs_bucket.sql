-- Payment Proofs Storage Bucket
-- Creates the private `payment-proofs` bucket and the RLS policies on
-- `storage.objects` for upload, read, and delete operations.
--
-- Path layout: `payment-proofs/{order_id}/{uuid}.{ext}` -- the first path
-- segment under the bucket is the order_id (UUID). RLS policies parse that
-- prefix to authorize access.

INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-proofs', 'payment-proofs', false)
ON CONFLICT (id) DO NOTHING;

-- Helper: extract the order_id (first path segment) from storage.objects.name
-- as a UUID. Returns NULL when the name does not start with a UUID-shaped
-- segment so the policies fail safely.
CREATE OR REPLACE FUNCTION public.payment_proof_order_id(p_name TEXT)
RETURNS UUID
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_first TEXT;
BEGIN
  IF p_name IS NULL THEN
    RETURN NULL;
  END IF;
  v_first := split_part(p_name, '/', 1);
  IF v_first ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RETURN v_first::uuid;
  END IF;
  RETURN NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.payment_proof_order_id(TEXT) TO authenticated;

-- Clean up any prior versions of the policies (idempotent re-runs).
DROP POLICY IF EXISTS "payment_proofs_buyer_insert" ON storage.objects;
DROP POLICY IF EXISTS "payment_proofs_select" ON storage.objects;
DROP POLICY IF EXISTS "payment_proofs_admin_delete" ON storage.objects;

-- INSERT: buyer of the order may upload into `{their_order_id}/` prefix only.
CREATE POLICY "payment_proofs_buyer_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'payment-proofs'
  AND public.payment_proof_order_id(name) IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.orders o
    WHERE o.id = public.payment_proof_order_id(name)
      AND o.buyer_id = auth.uid()
  )
);

-- SELECT: buyer, order's agent, order's agent's parent (super agent), or admin.
CREATE POLICY "payment_proofs_select"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'payment-proofs'
  AND public.payment_proof_order_id(name) IS NOT NULL
  AND (
    EXISTS (
      SELECT 1 FROM public.profiles me
      WHERE me.id = auth.uid() AND me.role = 'admin'
    )
    OR EXISTS (
      SELECT 1
      FROM public.orders o
      LEFT JOIN public.profiles ap ON ap.id = o.agent_id
      WHERE o.id = public.payment_proof_order_id(name)
        AND (
          o.buyer_id = auth.uid()
          OR o.agent_id = auth.uid()
          OR ap.parent_agent_id = auth.uid()
        )
    )
  )
);

-- DELETE: admin only.
CREATE POLICY "payment_proofs_admin_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'payment-proofs'
  AND EXISTS (
    SELECT 1 FROM public.profiles me
    WHERE me.id = auth.uid() AND me.role = 'admin'
  )
);

-- Helpful index for the frequent (order_id) prefix lookup.
CREATE INDEX IF NOT EXISTS payment_proofs_order_id_idx
  ON public.payment_proofs (order_id);
