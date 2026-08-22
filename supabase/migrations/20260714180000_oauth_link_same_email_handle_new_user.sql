-- =============================================================================
-- handle_new_user: make auth-user creation resilient to a duplicate real email
-- so the OAuth callback can LINK the sign-in to the existing account.
--
-- Why: on_auth_user_created (AFTER INSERT on auth.users) inserts a profiles row
-- carrying the real email. trg_enforce_unique_account_email (BEFORE INSERT on
-- profiles) raises 23505 for a duplicate email, which aborts the ENTIRE auth
-- user creation. That meant a returning regular-signup user who clicked "Sign
-- in with Google" failed at the database layer (Google could not create the
-- transient OAuth user at all), so the app could never identify the account to
-- log them into.
--
-- Fix: when the real email already belongs to another profile, store NULL for
-- this new row's email instead of the conflicting address. The auth user is
-- then created normally; app/auth/callback detects the email match and either
-- LINKS the person into their existing verified researcher account (minting its
-- session and deleting this transient OAuth user) or blocks as a duplicate.
-- A second profile carrying the same email is NEVER persisted, so the one-email-
-- one-account guarantee is preserved.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_full_name TEXT;
  v_first_name TEXT;
  v_last_name TEXT;
  v_email TEXT;
BEGIN
  v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', '');
  v_first_name := split_part(v_full_name, ' ', 1);
  IF strpos(v_full_name, ' ') > 0 THEN
    v_last_name := substr(v_full_name, strpos(v_full_name, ' ') + 1);
  ELSE
    v_last_name := NULL;
  END IF;

  -- The real (non-internal) email the auth user signed up with.
  v_email := CASE WHEN NEW.email LIKE '%@internal.auth' THEN NULL ELSE NEW.email END;

  -- If that email already belongs to ANOTHER account, store NULL here so the
  -- auth user can still be created (the BEFORE-INSERT unique-email guard would
  -- otherwise raise 23505 and abort auth-user creation). The OAuth callback
  -- links this sign-in to the existing account or blocks it; a duplicate
  -- profile with this email is never persisted.
  IF v_email IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE lower(coalesce(nullif(btrim(contact_email), ''), nullif(btrim(email), '')))
        = lower(btrim(v_email))
  ) THEN
    v_email := NULL;
  END IF;

  INSERT INTO public.profiles (id, email, full_name, first_name, last_name, role)
  VALUES (NEW.id, v_email, v_full_name, v_first_name, v_last_name, 'researcher')
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$function$;
