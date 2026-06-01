-- Fold explicit legacy push-bucket opt-outs into push_type_prefs.
--
-- The per-type Notification Preferences page (push_type_prefs) is now the single
-- push-delivery gate. lib/notify.ts and lib/push-enqueue.ts no longer consult the
-- coarse push_events_order / push_events_messages / push_events_marketing buckets.
--
-- This migration preserves users who had explicitly turned OFF order or message
-- pushes on the old coarse-bucket settings page by folding those opt-outs into
-- push_type_prefs.
--
-- push_events_marketing is intentionally NOT folded: it defaulted to false for
-- every row, so folding it would wrongly disable commission / referral / cart /
-- system pushes for all users. Under the new model those push types are
-- default-on (an absent key reads as ON) and individually controllable.
--
-- Merge direction (bucket || existing) lets any pre-existing per-type choice win
-- on key collision, and the statements are idempotent (re-running sets the same
-- false values).

update public.notification_preferences
set push_type_prefs =
  '{"order_placed":false,"order_approved":false,"order_shipped":false,"order_delivered":false,"order_cancelled":false}'::jsonb
  || coalesce(push_type_prefs, '{}'::jsonb)
where push_events_order = false;

update public.notification_preferences
set push_type_prefs =
  '{"new_message":false}'::jsonb || coalesce(push_type_prefs, '{}'::jsonb)
where push_events_messages = false;
