BEGIN;
  ALTER PUBLICATION supabase_realtime DROP TABLE public.messenger_messages;
  ALTER PUBLICATION supabase_realtime ADD TABLE public.messenger_messages;
COMMIT;
