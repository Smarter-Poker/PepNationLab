CREATE TABLE IF NOT EXISTS public.test_realtime_rls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid
);
ALTER TABLE public.test_realtime_rls ENABLE ROW LEVEL SECURITY;
CREATE POLICY test_realtime_rls_select ON public.test_realtime_rls FOR SELECT TO authenticated USING (user_id = auth.uid());
ALTER PUBLICATION supabase_realtime ADD TABLE public.test_realtime_rls;
