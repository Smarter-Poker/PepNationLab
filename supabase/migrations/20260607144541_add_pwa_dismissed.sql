ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS pwa_dismissed BOOLEAN DEFAULT false;
