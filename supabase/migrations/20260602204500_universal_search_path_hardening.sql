-- Universal Hardening: Ensure ALL SECURITY DEFINER functions explicitly set search_path
-- to prevent privilege escalation / schema hijacking.

DO $$
DECLARE
    rec record;
BEGIN
    FOR rec IN 
        SELECT p.proname, pg_get_function_identity_arguments(p.oid) as args
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
          AND p.prosecdef = true
    LOOP
        EXECUTE format('ALTER FUNCTION public.%I(%s) SET search_path = public;', rec.proname, rec.args);
    END LOOP;
END
$$;
