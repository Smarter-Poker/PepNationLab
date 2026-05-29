-- notification_preferences: per-user opt-ins (sms / push). Default everything off.
CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  sms_enabled BOOL NOT NULL DEFAULT false,
  sms_phone TEXT,
  sms_phone_verified BOOL NOT NULL DEFAULT false,
  events_order_approved BOOL NOT NULL DEFAULT true,
  events_order_shipped BOOL NOT NULL DEFAULT true,
  events_order_delivered BOOL NOT NULL DEFAULT true,
  events_payment_reminder BOOL NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "User manages own prefs" ON public.notification_preferences;
CREATE POLICY "User manages own prefs" ON public.notification_preferences
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- sms_outbox: queue + audit. Cron drains pending rows and dispatches.
CREATE TABLE IF NOT EXISTS public.sms_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  to_phone TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','failed','skipped')),
  provider TEXT NOT NULL DEFAULT 'twilio',
  provider_message_id TEXT,
  failure_reason TEXT,
  related_order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  event TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS sms_outbox_pending_idx ON public.sms_outbox(status, created_at) WHERE status = 'pending';
ALTER TABLE public.sms_outbox ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins read sms outbox" ON public.sms_outbox;
CREATE POLICY "Admins read sms outbox" ON public.sms_outbox FOR SELECT USING (public.is_admin());
DROP POLICY IF EXISTS "Admins manage sms outbox" ON public.sms_outbox;
CREATE POLICY "Admins manage sms outbox" ON public.sms_outbox FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());
