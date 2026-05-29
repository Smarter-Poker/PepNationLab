-- recently-viewed: per-user product browse history (cap 50/user via trigger)
CREATE TABLE IF NOT EXISTS public.researcher_recently_viewed (
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, product_id)
);
CREATE INDEX IF NOT EXISTS recently_viewed_user_time_idx ON public.researcher_recently_viewed(user_id, viewed_at DESC);
ALTER TABLE public.researcher_recently_viewed ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users manage own recently viewed" ON public.researcher_recently_viewed;
CREATE POLICY "Users manage own recently viewed" ON public.researcher_recently_viewed
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- trigger: trim to 50 most-recent rows per user after each insert/update
CREATE OR REPLACE FUNCTION public.trim_recently_viewed()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM public.researcher_recently_viewed
  WHERE user_id = NEW.user_id
    AND (user_id, product_id) NOT IN (
      SELECT user_id, product_id FROM public.researcher_recently_viewed
      WHERE user_id = NEW.user_id
      ORDER BY viewed_at DESC
      LIMIT 50
    );
  RETURN NULL;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.trim_recently_viewed() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trim_recently_viewed_trig ON public.researcher_recently_viewed;
CREATE TRIGGER trim_recently_viewed_trig AFTER INSERT OR UPDATE ON public.researcher_recently_viewed
  FOR EACH ROW EXECUTE FUNCTION public.trim_recently_viewed();

-- abandoned_cart_reminders: ledger so we never double-send within a window
CREATE TABLE IF NOT EXISTS public.abandoned_cart_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  cart_state_snapshot JSONB,
  cart_value NUMERIC,
  channel TEXT NOT NULL CHECK (channel IN ('in_app','sms','both')),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  recovered_order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS abandoned_cart_user_idx ON public.abandoned_cart_reminders(user_id, sent_at DESC);
ALTER TABLE public.abandoned_cart_reminders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins read abandoned cart reminders" ON public.abandoned_cart_reminders;
CREATE POLICY "Admins read abandoned cart reminders" ON public.abandoned_cart_reminders
  FOR SELECT USING (public.is_admin());
DROP POLICY IF EXISTS "Admins insert abandoned cart reminders" ON public.abandoned_cart_reminders;
CREATE POLICY "Admins insert abandoned cart reminders" ON public.abandoned_cart_reminders
  FOR INSERT WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "Users view own reminders" ON public.abandoned_cart_reminders;
CREATE POLICY "Users view own reminders" ON public.abandoned_cart_reminders
  FOR SELECT USING (user_id = auth.uid());
