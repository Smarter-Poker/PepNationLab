-- Once-per-user lifecycle campaign tracking (welcome backstop + FIRST20
-- first-order nudge). The cron writes the row BEFORE sending, so a crash or
-- partial failure can never replay a send. Service-role only (RLS deny-all).

CREATE TABLE IF NOT EXISTS public.lifecycle_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  kind text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, kind)
);

ALTER TABLE public.lifecycle_sends ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_lifecycle_sends_user ON public.lifecycle_sends (user_id);
