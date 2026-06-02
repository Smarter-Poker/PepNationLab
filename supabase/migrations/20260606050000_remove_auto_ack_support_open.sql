CREATE OR REPLACE FUNCTION public.fn_messenger_support_open(p_user_id uuid, p_topic text DEFAULT NULL::text, p_order_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_admin_id   uuid;
  v_conv_id    uuid;
  v_topic_clean text;
BEGIN
  SELECT id INTO v_admin_id FROM public.profiles WHERE role = 'admin' ORDER BY created_at ASC LIMIT 1;
  IF v_admin_id IS NULL THEN RAISE EXCEPTION 'No admin available for support routing'; END IF;

  v_topic_clean := NULLIF(trim(coalesce(p_topic, '')), '');

  SELECT c.id INTO v_conv_id
    FROM public.messenger_conversations c
   WHERE c.is_support = true
     AND EXISTS (SELECT 1 FROM public.messenger_participants p WHERE p.conversation_id = c.id AND p.user_id = p_user_id)
     AND EXISTS (SELECT 1 FROM public.messenger_participants p WHERE p.conversation_id = c.id AND p.user_id = v_admin_id)
   ORDER BY c.created_at ASC LIMIT 1;

  IF v_conv_id IS NOT NULL THEN
    IF v_topic_clean IS NOT NULL THEN
      UPDATE public.messenger_conversations SET support_topic = v_topic_clean
       WHERE id = v_conv_id AND support_topic IS NULL;
    END IF;
    IF p_order_id IS NOT NULL THEN
      UPDATE public.messenger_conversations SET support_order_id = p_order_id
       WHERE id = v_conv_id AND support_order_id IS NULL;
    END IF;
    RETURN v_conv_id;
  END IF;

  INSERT INTO public.messenger_conversations
    (type, is_support, title, created_by, support_status, support_topic, support_order_id)
  VALUES
    ('direct', true, COALESCE(v_topic_clean, 'Pep Nation Support'),
     p_user_id, 'open', v_topic_clean, p_order_id)
  RETURNING id INTO v_conv_id;

  INSERT INTO public.messenger_participants (conversation_id, user_id, role)
  VALUES (v_conv_id, p_user_id, 'member'), (v_conv_id, v_admin_id, 'member')
  ON CONFLICT DO NOTHING;

  -- AUTO-ACK message insertion was removed here so it doesn't fire prematurely.
  -- It will be fired when the user sends their first message instead.

  RETURN v_conv_id;
END;
$function$;
