-- Migration: Relocate extensions and consolidate multiple permissive RLS policies
-- Addresses Supabase security advisory 461 and hardening of pg_trgm/vector

-- ============================================================================
-- 1. EXTENSION RELOCATION
-- ============================================================================

-- Create a dedicated schema for extensions to remove them from public
CREATE SCHEMA IF NOT EXISTS extensions;

-- Move the extensions
ALTER EXTENSION IF EXISTS pg_trgm SET SCHEMA extensions;
ALTER EXTENSION IF EXISTS vector SET SCHEMA extensions;

-- Update role-level search paths so the application can still resolve functions like similarity()
ALTER ROLE authenticator SET search_path = public, extensions;
ALTER ROLE anon SET search_path = public, extensions;
ALTER ROLE authenticated SET search_path = public, extensions;
ALTER ROLE service_role SET search_path = public, extensions;
-- Ensure the postgres role (admin) also has it
ALTER ROLE postgres SET search_path = public, extensions;

-- Dynamically append 'extensions' to the search_path of all SECURITY DEFINER functions in public
DO $$
DECLARE
  rec record;
BEGIN
  FOR rec IN (
    SELECT p.oid::regprocedure::text AS func_sig
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
  ) LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public, extensions, pg_temp;', rec.func_sig);
  END LOOP;
END;
$$;


-- ============================================================================
-- 2. MULTIPLE PERMISSIVE RLS POLICY CONSOLIDATION (Fix Advisory 461)
-- ============================================================================

DO $$
DECLARE
  rec record;
  new_policy_name text;
  create_stmt text;
  drop_stmt text;
  p_name text;
BEGIN
  -- We group by schema, table, command, and role to find duplicates
  FOR rec IN (
    SELECT 
      p.schemaname, 
      p.tablename, 
      p.cmd, 
      r.rolename,
      array_agg(p.policyname) as pol_names,
      string_agg('(' || coalesce(p.qual, 'true') || ')', ' OR ') as merged_qual,
      -- If with_check is null, postgres falls back to qual.
      string_agg('(' || coalesce(p.with_check, p.qual, 'true') || ')', ' OR ') as merged_check
    FROM pg_policies p
    CROSS JOIN LATERAL unnest(p.roles) as r(rolename)
    WHERE p.permissive = 'PERMISSIVE' 
      AND p.schemaname IN ('public', 'storage')
    GROUP BY p.schemaname, p.tablename, p.cmd, r.rolename
    HAVING count(*) > 1
  )
  LOOP
    new_policy_name := 'merged_' || rec.cmd || '_' || rec.rolename;
    
    -- Drop the old policies
    FOREACH p_name IN ARRAY rec.pol_names LOOP
      drop_stmt := format('DROP POLICY IF EXISTS %I ON %I.%I;', p_name, rec.schemaname, rec.tablename);
      EXECUTE drop_stmt;
    END LOOP;
    
    -- Create the new merged policy
    create_stmt := format(
      'CREATE POLICY %I ON %I.%I FOR %s TO %I',
      new_policy_name, rec.schemaname, rec.tablename, rec.cmd, rec.rolename
    );
    
    IF rec.merged_qual IS NOT NULL AND rec.merged_qual != '' THEN
      create_stmt := create_stmt || ' USING (' || rec.merged_qual || ')';
    END IF;
    
    IF rec.cmd IN ('INSERT', 'UPDATE', 'ALL') AND rec.merged_check IS NOT NULL AND rec.merged_check != '' THEN
      create_stmt := create_stmt || ' WITH CHECK (' || rec.merged_check || ')';
    END IF;
    
    create_stmt := create_stmt || ';';
    
    EXECUTE create_stmt;
  END LOOP;
END
$$;
