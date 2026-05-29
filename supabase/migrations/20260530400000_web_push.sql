-- Web Push subscriptions per user/device
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  device_label TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  failure_count INTEGER NOT NULL DEFAULT 0,
  last_failure_reason TEXT,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, endpoint)
);
CREATE INDEX IF NOT EXISTS push_subscriptions_user_active_idx
  ON public.push_subscriptions(user_id) WHERE is_active = true;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "User manages own push subs" ON public.push_subscriptions;
CREATE POLICY "User manages own push subs" ON public.push_subscriptions
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "Admin reads all push subs" ON public.push_subscriptions;
CREATE POLICY "Admin reads all push subs" ON public.push_subscriptions
  FOR SELECT USING (public.is_admin());

-- Outbox / queue for delivery, drained by cron
CREATE TABLE IF NOT EXISTS public.push_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  url TEXT,
  icon_url TEXT,
  badge_url TEXT,
  tag TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','sent','failed','skipped')),
  attempts INTEGER NOT NULL DEFAULT 0,
  failure_reason TEXT,
  related_order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  event TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS push_outbox_pending_idx
  ON public.push_outbox(status, created_at) WHERE status = 'pending';
ALTER TABLE public.push_outbox ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin reads push outbox" ON public.push_outbox;
CREATE POLICY "Admin reads push outbox" ON public.push_outbox
  FOR SELECT USING (public.is_admin());

-- Extend notification_preferences with push fields. Use IF NOT EXISTS so the
-- migration is idempotent regardless of whether earlier SMS / messenger
-- migrations have already added overlapping rows.
ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS push_enabled BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS push_events_order BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS push_events_messages BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS push_events_marketing BOOLEAN NOT NULL DEFAULT false;
