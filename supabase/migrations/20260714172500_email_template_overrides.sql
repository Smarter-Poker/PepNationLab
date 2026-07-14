-- Admin-editable subject/body overrides for every code-defined email template
-- (owner request 2026-07-14). A row's NULL/absent field falls back to the
-- code default, so clearing an override safely restores original copy.
-- Service-role only (RLS deny-all).

CREATE TABLE IF NOT EXISTS public.email_template_overrides (
  key text PRIMARY KEY,
  subject text,
  body text,
  updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.email_template_overrides ENABLE ROW LEVEL SECURITY;
