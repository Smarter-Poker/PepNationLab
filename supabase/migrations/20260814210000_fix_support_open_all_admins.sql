-- =============================================================================
-- Fix: fn_messenger_support_open — add ALL admin accounts as participants
-- =============================================================================
-- Root cause: the previous implementation picked only the SINGLE oldest admin
-- (ORDER BY created_at ASC LIMIT 1). If the platform owner has more than one
-- admin account — or if the "active" admin is not the oldest one — the support
-- thread is invisible in the messenger inbox for every other admin.
--
-- Fix: when creating a new support conversation, add every active admin as a
-- participant so the thread appears in all admin inboxes. When reusing an
-- existing open thread, backfill any admin who is not yet a participant.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.fn_messenger_support_open(
  p_user_id uuid,
  p_topic   text    DEFAULT NULL,
  p_order_id uuid   DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_conv_id       uuid;
  v_topic_clean   text;
  v_admin_rec     RECORD;
BEGIN
  v_topic_clean := trim(p_topic);
  IF v_topic_clean = '' THEN v_topic_clean := NULL; END IF;

  -- -------------------------------------------------------------------------
  -- 1. Look for an existing OPEN support thread between this user and ANY admin.
  --    Resolved threads are excluded so the researcher gets a fresh thread.
  -- -------------------------------------------------------------------------
  SELECT c.id INTO v_conv_id
  FROM public.messenger_conversations c
  JOIN public.messenger_participants pa ON pa.conversation_id = c.id AND pa.user_id = p_user_id
  JOIN public.messenger_participants pb ON pb.conversation_id = c.id
  JOIN public.profiles adm             ON adm.id = pb.user_id AND adm.role = 'admin'
  WHERE c.is_support = true
    AND (c.support_status IS NULL OR c.support_status != 'resolved')
  ORDER BY c.created_at DESC
  LIMIT 1;

  IF v_conv_id IS NOT NULL THEN
    -- Update topic / order_id if they haven't been set yet.
    IF v_topic_clean IS NOT NULL THEN
      UPDATE public.messenger_conversations SET support_topic = v_topic_clean
       WHERE id = v_conv_id AND support_topic IS NULL;
    END IF;
    IF p_order_id IS NOT NULL THEN
      UPDATE public.messenger_conversations SET support_order_id = p_order_id
       WHERE id = v_conv_id AND support_order_id IS NULL;
    END IF;

    -- Backfill any admin not yet in this thread.
    FOR v_admin_rec IN
      SELECT id FROM public.profiles WHERE role = 'admin' AND is_active = true
    LOOP
      INSERT INTO public.messenger_participants (conversation_id, user_id, role)
      VALUES (v_conv_id, v_admin_rec.id, 'member')
      ON CONFLICT (conversation_id, user_id) DO NOTHING;
    END LOOP;

    RETURN v_conv_id;
  END IF;

  -- -------------------------------------------------------------------------
  -- 2. No open thread — create a new one.
  -- -------------------------------------------------------------------------
  INSERT INTO public.messenger_conversations
    (type, is_support, title, created_by, support_status, support_topic, support_order_id)
  VALUES
    ('direct', true, 'Support', p_user_id, 'open', v_topic_clean, p_order_id)
  RETURNING id INTO v_conv_id;

  -- Add the researcher.
  INSERT INTO public.messenger_participants (conversation_id, user_id, role)
  VALUES (v_conv_id, p_user_id, 'member')
  ON CONFLICT (conversation_id, user_id) DO NOTHING;

  -- Add ALL active admins so any admin can see and reply.
  FOR v_admin_rec IN
    SELECT id FROM public.profiles WHERE role = 'admin' AND is_active = true
  LOOP
    INSERT INTO public.messenger_participants (conversation_id, user_id, role)
    VALUES (v_conv_id, v_admin_rec.id, 'member')
    ON CONFLICT (conversation_id, user_id) DO NOTHING;
  END LOOP;

  -- Safety net: if no active admin was found, add the oldest admin as a fallback.
  IF NOT EXISTS (
    SELECT 1 FROM public.messenger_participants p2
    JOIN public.profiles adm2 ON adm2.id = p2.user_id AND adm2.role = 'admin'
    WHERE p2.conversation_id = v_conv_id
  ) THEN
    INSERT INTO public.messenger_participants (conversation_id, user_id, role)
    SELECT v_conv_id, id, 'member'
    FROM public.profiles
    WHERE role = 'admin'
    ORDER BY created_at ASC
    LIMIT 1
    ON CONFLICT (conversation_id, user_id) DO NOTHING;
  END IF;

  RETURN v_conv_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_messenger_support_open(uuid, text, uuid) TO authenticated;

-- =============================================================================
-- Backfill: add missing admins to ALL existing open support threads
-- This ensures any previously created support thread (where only the oldest
-- admin was a participant) now shows up in every admin's messenger inbox.
-- =============================================================================
DO $$
DECLARE
  v_conv   RECORD;
  v_admin  RECORD;
BEGIN
  FOR v_conv IN
    SELECT id FROM public.messenger_conversations
    WHERE is_support = true
      AND (support_status IS NULL OR support_status != 'resolved')
  LOOP
    FOR v_admin IN
      SELECT id FROM public.profiles WHERE role = 'admin' AND is_active = true
    LOOP
      INSERT INTO public.messenger_participants (conversation_id, user_id, role)
      VALUES (v_conv.id, v_admin.id, 'member')
      ON CONFLICT (conversation_id, user_id) DO NOTHING;
    END LOOP;
  END LOOP;
END$$;
