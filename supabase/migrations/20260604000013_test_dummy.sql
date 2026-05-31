CREATE TABLE IF NOT EXISTS public.test_realtime_dummy (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  text text
);
ALTER PUBLICATION supabase_realtime ADD TABLE public.test_realtime_dummy;
