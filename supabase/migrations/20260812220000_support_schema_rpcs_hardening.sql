-- =============================================================================
-- Migration: support_schema_rpcs_hardening
-- Applied: 2026-08-12
-- Purpose:
--   1. Ensures all support-related columns on messenger_conversations exist.
--   2. Ensures messenger_support_internal_notes table exists.
--   3. Creates fn_messenger_support_set_status (SECURITY DEFINER, admin-only).
--   4. Creates fn_messenger_support_snooze (SECURITY DEFINER, admin-only).
--   5. Fixes fn_messenger_support_open: resolved threads are no longer reused;
--      they are re-opened with support_status reset to 'open'.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Support columns on messenger_conversations (IF NOT EXISTS guards)
-- ---------------------------------------------------------------------------
ALTER TABLE public.messenger_conversations
  ADD COLUMN IF NOT EXISTS is_support BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS support_status TEXT NOT NULL DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS support_topic TEXT,
  ADD COLUMN IF NOT EXISTS support_order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS support_snoozed_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS support_first_response_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS support_last_researcher_message_at TIMESTAMPTZ;

-- Constraint to enforce valid status values.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'messenger_conversations_support_status_check'
  ) THEN
    ALTER TABLE public.messenger_conversations
      ADD CONSTRAINT messenger_conversations_support_status_check
      CHECK (support_status IN ('open','in_progress','waiting_on_researcher','resolved'));
  END IF;
END$$;

-- Index for fast inbox queries.
CREATE INDEX IF NOT EXISTS idx_messenger_conversations_is_support
  ON public.messenger_conversations (is_support)
  WHERE is_support = true;

-- ---------------------------------------------------------------------------
-- 2. messenger_support_internal_notes (admin-only internal notes per thread)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.messenger_support_internal_notes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.messenger_conversations(id) ON DELETE CASCADE,
  author_id       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body            TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.messenger_support_internal_notes ENABLE ROW LEVEL SECURITY;

-- RLS: admins can read and write all internal notes; researchers cannot see them.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'messenger_support_internal_notes'
      AND policyname = 'admin_manage_support_notes'
  ) THEN
    CREATE POLICY admin_manage_support_notes ON public.messenger_support_internal_notes
      FOR ALL TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = auth.uid() AND role = 'admin'
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = auth.uid() AND role = 'admin'
        )
      );
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_support_notes_conv
  ON public.messenger_support_internal_notes (conversation_id);

-- ---------------------------------------------------------------------------
-- 3. fn_messenger_support_set_status — admin sets status on a support thread
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_messenger_support_set_status(
  p_conv   uuid,
  p_status text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_caller_role text;
BEGIN
  -- Gate: caller must be admin.
  SELECT role INTO v_caller_role FROM public.profiles WHERE id = auth.uid();
  IF v_caller_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  -- Validate status value.
  IF p_status NOT IN ('open','in_progress','waiting_on_researcher','resolved') THEN
    RAISE EXCEPTION 'Invalid support status: %', p_status;
  END IF;

  -- Update the conversation.
  UPDATE public.messenger_conversations
  SET support_status = p_status
  WHERE id = p_conv AND is_support = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Support conversation not found';
  END IF;

  -- Write audit entry (best-effort; does not block on failure).
  BEGIN
    INSERT INTO public.admin_audit_log (actor_id, action, entity_type, entity_id, changes)
    VALUES (
      auth.uid(),
      'support_status_change',
      'messenger_conversations',
      p_conv,
      jsonb_build_object('support_status', p_status)
    );
  EXCEPTION WHEN OTHERS THEN
    NULL; -- Do not fail the status update if audit log insert fails.
  END;
END;
$$;

-- Grant execute to authenticated users (the RPC itself enforces admin check).
GRANT EXECUTE ON FUNCTION public.fn_messenger_support_set_status(uuid, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. fn_messenger_support_snooze — admin snoozes/un-snoozes a support thread
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_messenger_support_snooze(
  p_conv  uuid,
  p_until timestamptz
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_caller_role text;
BEGIN
  -- Gate: caller must be admin.
  SELECT role INTO v_caller_role FROM public.profiles WHERE id = auth.uid();
  IF v_caller_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  UPDATE public.messenger_conversations
  SET support_snoozed_until = p_until
  WHERE id = p_conv AND is_support = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Support conversation not found';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_messenger_support_snooze(uuid, timestamptz) TO authenticated;

-- ---------------------------------------------------------------------------
-- 5. Fix fn_messenger_support_open: reset status when re-opening a resolved
--    thread so the researcher doesn't land back in a visually-closed thread.
-- ---------------------------------------------------------------------------
-- NOTE: The full replacement of fn_messenger_support_open is below.
-- This replaces the version in 20260606050000_remove_auto_ack_support_open.sql.
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
  v_admin_id      uuid;
  v_conv_id       uuid;
  v_topic_clean   text;
BEGIN
  -- Find the primary admin (oldest admin account).
  SELECT id INTO v_admin_id
  FROM public.profiles
  WHERE role = 'admin'
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_admin_id IS NULL THEN
    RAISE EXCEPTION 'No admin account found';
  END IF;

  v_topic_clean := trim(p_topic);
  IF v_topic_clean = '' THEN v_topic_clean := NULL; END IF;

  -- Look for an existing OPEN (non-resolved) support thread between this user
  -- and admin. Resolved threads are intentionally excluded so the researcher
  -- gets a fresh thread rather than re-opening an old closed one.
  SELECT c.id INTO v_conv_id
  FROM public.messenger_conversations c
  JOIN public.messenger_participants pa ON pa.conversation_id = c.id AND pa.user_id = p_user_id
  JOIN public.messenger_participants pb ON pb.conversation_id = c.id AND pb.user_id = v_admin_id
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
    RETURN v_conv_id;
  END IF;

  -- No open thread — create a new one.
  INSERT INTO public.messenger_conversations
    (type, is_support, title, created_by, support_status, support_topic, support_order_id)
  VALUES
    ('direct', true, 'Support', p_user_id, 'open', v_topic_clean, p_order_id)
  RETURNING id INTO v_conv_id;

  -- Add both the researcher and the admin as participants.
  INSERT INTO public.messenger_participants (conversation_id, user_id, role)
  VALUES
    (v_conv_id, p_user_id, 'member'),
    (v_conv_id, v_admin_id, 'member')
  ON CONFLICT (conversation_id, user_id) DO NOTHING;

  RETURN v_conv_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fn_messenger_support_open(uuid, text, uuid) TO authenticated;
