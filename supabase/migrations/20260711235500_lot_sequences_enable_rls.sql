-- Enable RLS on lot_sequences (COA lot-number counter). Resolves the
-- rls_disabled_in_public ERROR advisor. Only the SECURITY DEFINER COA
-- lot-numbering function (service role) writes this table; no client path reads
-- it, so RLS-on with no policy correctly locks out anon/authenticated while the
-- service role continues to bypass RLS.
ALTER TABLE public.lot_sequences ENABLE ROW LEVEL SECURITY;
