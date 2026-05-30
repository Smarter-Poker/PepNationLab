-- ============================================================
-- Fix: Allow the create-researcher API route to UPDATE the
-- newly-created researcher profile row.
-- 
-- Background: auth.admin.createUser() fires the handle_new_user
-- trigger which INSERTs a partial profile row. The route then
-- needs to UPDATE that row with referring_agent_id, full_name,
-- username, etc.
--
-- The createServiceClient() (@supabase/ssr) does NOT bypass RLS,
-- so we need an explicit UPDATE policy for the agent.
-- ============================================================

DROP POLICY IF EXISTS "Agents can update researcher profiles they created" ON public.profiles;

CREATE POLICY "Agents can update researcher profiles they created" ON public.profiles
  FOR UPDATE
  USING (
    -- The row being updated must be a researcher
    role = 'researcher'
    AND
    -- The caller must be an active agent or above
    public.is_agent_or_above()
  )
  WITH CHECK (
    -- After update, role must still be researcher (no escalation)
    role = 'researcher'
  );
