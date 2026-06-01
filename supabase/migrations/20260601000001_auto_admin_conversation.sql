-- fix-45: auto-spawn a direct messenger conversation between every active
-- admin and every non-admin user at the moment they become active. Solves
-- "admin can't see/message new agents until they message admin first" by
-- making the conversation exist on day one. Works for ANY signup path
-- (admin-created agent/super_agent/researcher, agent-created researcher,
-- storefront self-register) because it lives at the profiles row level.

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
    -- A new admin (or admin reactivation) needs conversations with every
    -- existing non-admin so the admin sees the whole roster on day one.
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

-- One-time backfill for existing users that lack the conversation.
DO $$
DECLARE
  u RECORD;
BEGIN
  FOR u IN SELECT id FROM public.profiles WHERE role <> 'admin' AND is_active = true
  LOOP
    PERFORM public.fn_ensure_admin_conversations_for_user(u.id);
  END LOOP;
END $$;
