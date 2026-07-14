-- Admin Email Center: ad-hoc campaign sends composed in /admin/email-center.
-- One row per blast; individual deliveries land in email_log as usual
-- (template 'admin_blast'). Service-role only (RLS deny-all).

CREATE TABLE IF NOT EXISTS public.email_blasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject text NOT NULL,
  body text NOT NULL,
  audience text NOT NULL,
  include_promo boolean NOT NULL DEFAULT false,
  sent_count integer NOT NULL DEFAULT 0,
  skipped_count integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.email_blasts ENABLE ROW LEVEL SECURITY;
