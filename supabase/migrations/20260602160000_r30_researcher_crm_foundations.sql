-- R30: Researcher CRM foundations
-- Adds tags, pins, reminders, saved segments. Existing tables we reuse:
--   agent_researcher_notes (notes)
--   agent_sales_goals (revenue targets)
--   researcher_referrals (referral graph)

-- 1. TAGS ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.agent_researcher_tags (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  researcher_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tag           text NOT NULL CHECK (length(tag) > 0 AND length(tag) <= 32),
  color         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (agent_id, researcher_id, tag)
);
CREATE INDEX IF NOT EXISTS art_agent_idx ON public.agent_researcher_tags (agent_id);
CREATE INDEX IF NOT EXISTS art_researcher_idx ON public.agent_researcher_tags (researcher_id);
ALTER TABLE public.agent_researcher_tags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS art_owner_all ON public.agent_researcher_tags;
CREATE POLICY art_owner_all ON public.agent_researcher_tags
  FOR ALL TO authenticated
  USING (agent_id = auth.uid())
  WITH CHECK (agent_id = auth.uid());

-- 2. PINS ------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.agent_researcher_pins (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  researcher_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  pinned_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (agent_id, researcher_id)
);
CREATE INDEX IF NOT EXISTS arp_agent_idx ON public.agent_researcher_pins (agent_id);
ALTER TABLE public.agent_researcher_pins ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS arp_owner_all ON public.agent_researcher_pins;
CREATE POLICY arp_owner_all ON public.agent_researcher_pins
  FOR ALL TO authenticated
  USING (agent_id = auth.uid())
  WITH CHECK (agent_id = auth.uid());

-- 3. REMINDERS -------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.agent_researcher_reminders (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  researcher_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title         text NOT NULL CHECK (length(title) > 0 AND length(title) <= 200),
  remind_at     timestamptz NOT NULL,
  completed_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS arr_agent_remind_idx ON public.agent_researcher_reminders (agent_id, remind_at);
CREATE INDEX IF NOT EXISTS arr_researcher_idx ON public.agent_researcher_reminders (researcher_id);
ALTER TABLE public.agent_researcher_reminders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS arr_owner_all ON public.agent_researcher_reminders;
CREATE POLICY arr_owner_all ON public.agent_researcher_reminders
  FOR ALL TO authenticated
  USING (agent_id = auth.uid())
  WITH CHECK (agent_id = auth.uid());

-- 4. SAVED SEGMENTS --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.agent_saved_segments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name          text NOT NULL CHECK (length(name) > 0 AND length(name) <= 60),
  filters       jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ass_agent_idx ON public.agent_saved_segments (agent_id);
ALTER TABLE public.agent_saved_segments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ass_owner_all ON public.agent_saved_segments;
CREATE POLICY ass_owner_all ON public.agent_saved_segments
  FOR ALL TO authenticated
  USING (agent_id = auth.uid())
  WITH CHECK (agent_id = auth.uid());

-- 5. RESEARCHER GROWTH GOALS ----------------------------------------------
CREATE TABLE IF NOT EXISTS public.agent_researcher_growth_goals (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  period_start  date NOT NULL,
  period_end    date NOT NULL,
  target_count  integer NOT NULL CHECK (target_count >= 0),
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (agent_id, period_start)
);
CREATE INDEX IF NOT EXISTS arg_agent_period_idx ON public.agent_researcher_growth_goals (agent_id, period_start DESC);
ALTER TABLE public.agent_researcher_growth_goals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS arg_owner_all ON public.agent_researcher_growth_goals;
CREATE POLICY arg_owner_all ON public.agent_researcher_growth_goals
  FOR ALL TO authenticated
  USING (agent_id = auth.uid())
  WITH CHECK (agent_id = auth.uid());

-- 6. SOURCE ATTRIBUTION ---------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='profiles' AND column_name='acquisition_source'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN acquisition_source text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='profiles' AND column_name='acquisition_metadata'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN acquisition_metadata jsonb;
  END IF;
END $$;

COMMENT ON COLUMN public.profiles.acquisition_source IS 'How this researcher was acquired: storefront, invite_link, agent_created, qr, referral';
COMMENT ON COLUMN public.profiles.acquisition_metadata IS 'Optional context (e.g., {"qr_id":"abc","invited_by":"uuid"})';
