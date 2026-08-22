-- Widen notifications.type CHECK so the app's newer notification types are
-- accepted instead of silently failing the insert (notify() swallows errors).
-- Adds: incoming_call, missed_call (messenger call bell entries) and
-- payment_confirmed, order_attention (already emitted by lib/notify.ts).
-- Idempotent: drop-if-exists then re-add so re-running is safe.
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check
CHECK (type = ANY (ARRAY[
  'order_placed','order_approved','order_shipped','order_delivered','order_cancelled',
  'commission_earned','new_researcher','new_message','invoice','payment_reminder',
  'cart_reminder','referral','system','low_stock',
  'incoming_call','missed_call','payment_confirmed','order_attention'
]));
