-- Remove SMS infrastructure entirely. PepNationLab does not have a Twilio
-- account; this layer was built speculatively and is being retired.

-- 1. sms_outbox: drop the queue entirely (no production rows of value — pre-launch).
DROP TABLE IF EXISTS public.sms_outbox CASCADE;

-- 2. notification_preferences: drop SMS-only columns. Keep push columns + event toggles.
ALTER TABLE public.notification_preferences DROP COLUMN IF EXISTS sms_enabled;
ALTER TABLE public.notification_preferences DROP COLUMN IF EXISTS sms_phone;
ALTER TABLE public.notification_preferences DROP COLUMN IF EXISTS sms_phone_verified;
-- the events_payment_reminder column was shared by SMS + push so KEEP it
-- (push still uses it). Same for events_order_approved/shipped/delivered.

-- 3. cron_runs rows for sms_dispatch can stay as historical noise — no schema change needed.

-- 4. internal_messages typed 'sms_*' do not exist; safe.
