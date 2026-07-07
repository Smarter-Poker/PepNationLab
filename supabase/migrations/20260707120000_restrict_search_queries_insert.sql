-- Security: search_q_service_write was created without a TO clause, so it
-- applied to {public} — anyone holding the anon key could INSERT arbitrary
-- rows into search_queries (log poisoning / storage abuse). Both writers
-- (app/api/research/search, app/api/research/click) use the service-role
-- client, which bypasses RLS, so scoping the policy to service_role is a
-- no-op for the app and closes the anon write path.
DROP POLICY IF EXISTS search_q_service_write ON public.search_queries;
CREATE POLICY search_q_service_write ON public.search_queries
  FOR INSERT TO service_role
  WITH CHECK (true);
