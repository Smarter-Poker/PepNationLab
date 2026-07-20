-- Widen the commission_pct range check so a Super Agent can assign a
-- downline Agent a markup above the old 40% ceiling (per Dan, 2026-07-20:
-- the Create Agent form now lets a Super Agent set "Your Markup On This
-- Agent" from 0-200%, and the platform default introduced 2026-07-19
-- (see 20260719223000_default_super_to_agent_markup_50.sql) is itself 50%,
-- already above the old 40% cap).
--
-- profiles.commission_pct is a SHARED column with two very different
-- meanings depending on is_sub_agent:
--   - is_sub_agent = true  -> a recruiter's cut of gross order subtotal
--                             (fn_calculate_sub_agent_commission pays this
--                             out in real dollars); must stay bounded well
--                             under 100% or a recruiter could be paid more
--                             than the order is worth. Left at 0-40 exactly
--                             as the original 20260531100000 migration set.
--   - is_sub_agent = false -> reused as base_markup by
--                             fn_agent_effective_markup (cost multiplier,
--                             not a payout) - safe to allow a much wider
--                             range. Widened to 0-200.
--
-- NOTE: this migration must be applied (supabase db push / apply_migration)
-- before the widened Create Agent / Agent Detail markup UI can actually
-- save any value above 40% - until then, the DB CHECK will reject it with
-- a 23514 constraint violation.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_commission_pct_range') THEN
    ALTER TABLE public.profiles DROP CONSTRAINT profiles_commission_pct_range;
  END IF;
END $$;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_commission_pct_range
  CHECK (
    commission_pct IS NULL
    OR (is_sub_agent AND commission_pct >= 0 AND commission_pct <= 40)
    OR (NOT is_sub_agent AND commission_pct >= 0 AND commission_pct <= 200)
  );
