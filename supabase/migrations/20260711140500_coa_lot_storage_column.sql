-- Per-lot storage instruction shown on the certificate (Fahrenheit by default in
-- the UI). Optional; blank falls back to the certificate's default.
ALTER TABLE public.product_lots
  ADD COLUMN IF NOT EXISTS storage text;
