-- ============================================================
-- notifications table: dedicated in-app notification store
-- Separate from internal_messages (messenger) and push_outbox (web push)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.notifications (
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type        TEXT NOT NULL CHECK (type IN (
                'order_placed', 'order_approved', 'order_shipped', 'order_delivered',
                'order_cancelled', 'commission_earned', 'new_researcher', 'new_message',
                'invoice', 'payment_reminder', 'cart_reminder', 'referral', 'system'
              )),
  title       TEXT NOT NULL,
  body        TEXT,
  url         TEXT,
  read_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Fast unread count per user
CREATE INDEX IF NOT EXISTS notifications_user_unread_idx
  ON public.notifications (user_id, created_at DESC)
  WHERE read_at IS NULL;

-- Full history per user
CREATE INDEX IF NOT EXISTS notifications_user_all_idx
  ON public.notifications (user_id, created_at DESC);

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can read their own notifications
CREATE POLICY "users can read own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

-- Users can update (mark read) their own notifications
CREATE POLICY "users can mark own notifications read"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Service role / admin can insert for any user (fire-and-forget from API routes)
-- No INSERT policy needed — service role bypasses RLS

-- ── Realtime ─────────────────────────────────────────────────────────────────
-- Enable Realtime so the bell component can subscribe to new rows
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- ── Retention: auto-delete notifications older than 90 days ─────────────────
-- (Run via cron or pg_cron if available; harmless if not)
CREATE OR REPLACE FUNCTION public.prune_old_notifications()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM public.notifications WHERE created_at < now() - INTERVAL '90 days';
END;
$$;
