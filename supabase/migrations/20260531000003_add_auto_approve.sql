-- Add auto_approve_orders flag to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS auto_approve_orders BOOLEAN DEFAULT FALSE;
