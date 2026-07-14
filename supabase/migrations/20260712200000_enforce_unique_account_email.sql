-- One real email = one account. Blocks a second account (e.g. via Google OAuth
-- when a regular account already exists, or vice-versa) with an email already in
-- use. Enforced as a trigger on profiles so it fires on EVERY creation path.
-- (Applied to prod via the management API; file added for replayability.)
CREATE OR REPLACE FUNCTION public.enforce_unique_account_email()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_new_em text; v_old_em text; v_dupe uuid;
BEGIN
  v_new_em := lower(coalesce(nullif(btrim(NEW.contact_email), ''), nullif(btrim(NEW.email), '')));
  IF v_new_em IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' THEN
    v_old_em := lower(coalesce(nullif(btrim(OLD.contact_email), ''), nullif(btrim(OLD.email), '')));
    IF v_old_em IS NOT DISTINCT FROM v_new_em THEN RETURN NEW; END IF;
  END IF;
  SELECT id INTO v_dupe FROM public.profiles
   WHERE id <> NEW.id
     AND lower(coalesce(nullif(btrim(contact_email), ''), nullif(btrim(email), ''))) = v_new_em
   LIMIT 1;
  IF v_dupe IS NOT NULL THEN
    RAISE EXCEPTION 'An account already exists for this email address.'
      USING ERRCODE = '23505', CONSTRAINT = 'profiles_effective_email_unique';
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_enforce_unique_account_email ON public.profiles;
CREATE TRIGGER trg_enforce_unique_account_email
BEFORE INSERT OR UPDATE OF email, contact_email ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.enforce_unique_account_email();
