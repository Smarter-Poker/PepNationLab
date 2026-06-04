-- Support ticket intake. Email is disabled platform-wide, so this in-app queue
-- is the durable channel for help requests. RLS: a user reads/opens only their
-- own tickets; admins can read and manage all.
CREATE TABLE IF NOT EXISTS public.support_requests (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject     text NOT NULL,
  category    text NOT NULL DEFAULT 'general',
  message     text NOT NULL,
  status      text NOT NULL DEFAULT 'open',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT support_requests_category_chk CHECK (category IN ('general','order','payment','technical','compliance','account')),
  CONSTRAINT support_requests_status_chk   CHECK (status IN ('open','in_progress','resolved'))
);

CREATE INDEX IF NOT EXISTS idx_support_requests_user ON public.support_requests(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_requests_status ON public.support_requests(status, created_at DESC);

ALTER TABLE public.support_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS support_requests_select_own ON public.support_requests;
CREATE POLICY support_requests_select_own ON public.support_requests
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS support_requests_insert_own ON public.support_requests;
CREATE POLICY support_requests_insert_own ON public.support_requests
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS support_requests_admin_all ON public.support_requests;
CREATE POLICY support_requests_admin_all ON public.support_requests
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
