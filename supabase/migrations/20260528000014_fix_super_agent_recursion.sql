-- DROP the recursive policy
DROP POLICY IF EXISTS "Super Agents can view downline researchers" ON profiles;

-- CREATE a safe function to get sub-agent IDs bypassing RLS
CREATE OR REPLACE FUNCTION public.get_sub_agent_ids(super_agent_uuid UUID)
RETURNS TABLE (id UUID)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id FROM profiles p WHERE p.parent_agent_id = super_agent_uuid;
$$;

-- RECREATE the policy safely using the bypass function
CREATE POLICY "Super Agents can view downline researchers" ON profiles
  FOR SELECT USING (
    referring_agent_id IN (SELECT id FROM public.get_sub_agent_ids(auth.uid()))
  );
