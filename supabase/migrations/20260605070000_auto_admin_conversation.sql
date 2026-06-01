-- fix-45 (rebased to a unique version).
--
-- Original file was checked in at 20260601000001_auto_admin_conversation.sql,
-- which collided with the existing 20260601000001_shippo_platform.sql.
-- Same SQL, applied here at version 20260605070000 so a fresh `supabase db
-- reset` does not blow up on the duplicate prefix.
--
-- All statements are idempotent (CREATE OR REPLACE, DROP+CREATE on the
-- trigger) so re-running against production — where the objects are
-- already live — is a no-op.

CREATE OR REPLACE FUNCTION public.fn_ensure_admin_conversations_for_user(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_rec RECORD;
  v_existing_id uuid;
  v_new_conv_id uuid;
BEGIN
  FOR admin_rec IN
    SELECT id FROM public.profiles
    WHERE role = 'admin' AND is_active = true AND id <> p_user_id
  LOOP
    SELECT mp1.conversation_id INTO v_existing_id
    FROM public.messenger_participants mp1
    JOIN public.messenger_participants mp2 ON mp1.conversation_id = mp2.conversation_id
    JOIN public.messenger_conversations c ON c.id = mp1.conversation_id
    WHERE mp1.user_id = p_user_id
      AND mp2.user_id = admin_rec.id
      AND c.type = 'direct'
    LIMIT 1;

    IF v_existing_id IS NULL THEN
      INSERT INTO public.messenger_conversations (type, created_by)
      VALUES ('direct', admin_rec.id)
      RETURNING id INTO v_new_conv_id;

      INSERT INTO public.messenger_participants (conversation_id, user_id, role)
      VALUES
        (v_new_conv_id, admin_rec.id, 'member'),
        (v_new_conv_id, p_user_id, 'member');
    END IF;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_ensure_admin_conversations_for_user(uuid)
  TO service_role, authenticated;

CREATE OR REPLACE FUNCTION public.fn_auto_admin_conversation_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  other_user RECORD;
BEGIN
  IF NEW.role = 'admin' THEN
    IF (TG_OP = 'INSERT' AND NEW.is_active IS TRUE)
       OR (TG_OP = 'UPDATE' AND OLD.is_active IS DISTINCT FROM NEW.is_active AND NEW.is_active IS TRUE) THEN
      FOR other_user IN
        SELECT id FROM public.profiles WHERE role <> 'admin' AND is_active = true
      LOOP
        PERFORM public.fn_ensure_admin_conversations_for_user(other_user.id);
      END LOOP;
    END IF;
    RETURN NEW;
  END IF;

  IF (TG_OP = 'INSERT' AND NEW.is_active IS TRUE)
     OR (TG_OP = 'UPDATE' AND OLD.is_active IS DISTINCT FROM NEW.is_active AND NEW.is_active IS TRUE) THEN
    PERFORM public.fn_ensure_admin_conversations_for_user(NEW.id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_auto_admin_conversation ON public.profiles;
CREATE TRIGGER trg_profiles_auto_admin_conversation
AFTER INSERT OR UPDATE OF is_active ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.fn_auto_admin_conversation_trigger();
