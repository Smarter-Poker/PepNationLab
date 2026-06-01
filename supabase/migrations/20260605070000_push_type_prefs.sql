-- Per-event push notification toggles.
-- A jsonb map of { notification_type | 'call_incoming' : boolean }. An absent
-- key means the push type is ENABLED (default on); only an explicit false
-- suppresses that specific push type for the user. Consumed by lib/push-prefs.ts
-- (pushTypeAllowed) from notify(), enqueuePush(), and the call-ring push path.

alter table public.notification_preferences
  add column if not exists push_type_prefs jsonb not null default '{}'::jsonb;

comment on column public.notification_preferences.push_type_prefs is
  'Per-event push toggles. Map of { notification_type | call_incoming : boolean }. Absent key = enabled (default on); false = that specific push type is suppressed for this user.';
