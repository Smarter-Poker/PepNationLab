-- Helpers for signup/OAuth routes to give a clean "account already exists"
-- message before creating an auth user. The trigger above is the authoritative
-- guard. (Applied to prod via the management API; file added for replayability.)
CREATE OR REPLACE FUNCTION public.account_email_exists(p_email text)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles
    WHERE lower(coalesce(nullif(btrim(contact_email), ''), nullif(btrim(email), '')))
        = lower(nullif(btrim(p_email), '')));
$$;
REVOKE ALL ON FUNCTION public.account_email_exists(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.account_email_exists(text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.account_email_owner(p_email text, p_exclude_id uuid)
RETURNS uuid LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT id FROM public.profiles
  WHERE id <> p_exclude_id
    AND lower(coalesce(nullif(btrim(contact_email), ''), nullif(btrim(email), '')))
      = lower(nullif(btrim(p_email), ''))
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.account_email_owner(text, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.account_email_owner(text, uuid) TO authenticated, service_role;
