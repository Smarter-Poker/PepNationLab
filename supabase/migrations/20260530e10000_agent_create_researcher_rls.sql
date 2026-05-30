-- ============================================================
-- Fix: Agents can create researcher profiles
-- The create-researcher API route uses createServiceClient()
-- (built on @supabase/ssr createServerClient) which does NOT
-- automatically bypass RLS even with the service role key,
-- unlike the raw @supabase/supabase-js createClient.
-- Add an explicit INSERT policy so active agents can insert a
-- profile row for a newly-created researcher they sponsor.
-- ============================================================

-- Drop any prior version of this policy to allow idempotent re-runs.
DROP POLICY IF EXISTS "Agents can insert researcher profiles" ON public.profiles;

CREATE POLICY "Agents can insert researcher profiles" ON public.profiles
  FOR INSERT
  WITH CHECK (
    -- The caller must be an active agent (or above)
    public.is_agent_or_above()
    AND
    -- The row being inserted must be a researcher role only
    role = 'researcher'
  );
