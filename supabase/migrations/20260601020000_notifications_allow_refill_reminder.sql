-- Allow the refill-reminder notification type in the in-app bell feed.
-- The 21-day refill drip (/api/cron/refill-reminders) enqueues notifications
-- with type='refill_reminder'; the old CHECK constraint omitted it, so those
-- in-app rows were silently rejected by notifications_type_check (the web push
-- and Messenger DM still delivered, but the bell-feed row + realtime toast did
-- not fire for refill reminders). Add the value so refill reminders behave like
-- every other notification type.
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check
  CHECK (type = ANY (ARRAY[
    'order_placed'::text, 'order_approved'::text, 'order_shipped'::text,
    'order_delivered'::text, 'order_cancelled'::text, 'commission_earned'::text,
    'new_researcher'::text, 'new_message'::text, 'invoice'::text,
    'payment_reminder'::text, 'cart_reminder'::text, 'refill_reminder'::text,
    'referral'::text, 'system'::text
  ]));
