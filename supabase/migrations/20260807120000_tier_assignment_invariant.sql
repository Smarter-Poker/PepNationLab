-- Tier assignment did not stick; every new agent read as 49% (2026-08-07).
--
-- ROOT CAUSE. Effective agent pricing resolves as custom_markup_override (a
-- flat fraction) FIRST, else the house tier from fn_resolve_house_tier_level().
-- fn_resolve_house_tier_level only honors the admin-assigned tier when
-- fixed_scale_override = true AND locked_tier_level IS NOT NULL; otherwise it
-- silently falls back to a 30-day-VOLUME lookup. So profiles.tier on its own is
-- DECORATIVE. Two independent ways the admin's choice was being lost:
--
--   1. fn_sync_tier_lock_on_tier_change was BEFORE *UPDATE OF tier* only and
--      keyed on NEW.tier IS DISTINCT FROM OLD.tier. Any INSERT path that set
--      `tier` without also writing locked_tier_level + fixed_scale_override,
--      and any later write that cleared the lock (e.g. the tier-override route
--      posting enabled:false), left a tier that displays but does not price.
--      Pricing then fell back to volume -- and house_tiers level 1 = 0.49, i.e.
--      the reported "49%".
--   2. custom_markup_override outranks the tier in resolveV2Markup(), so a flat
--      markup written elsewhere (e.g. the top-level super-agent onboarding
--      markup step, default 0.5) silently superseded the admin's tier while
--      profiles.tier kept displaying the old value -- "it didn't save".
--
-- FIX = enforce the mutual exclusion in the DATABASE, so no current or future
-- code path can persist a tier that does not actually price. LAST WRITER WINS,
-- because the pricing engine can only honor one of the two:
--
--   tier just assigned   -> lock it (locked_tier_level, fixed_scale_override,
--                           house_tier_level) and clear custom_markup_override
--   flat markup just set -> clear tier + lock; the markup governs
--   neither just changed -> re-assert the lock for an existing tier so it can
--                           never decay back into a decorative value
--
-- Last-writer-wins (rather than "tier always wins") is required so the flows
-- that legitimately assign a FLAT markup without touching tier keep working:
-- the admin Global Pricing Override (app/api/admin/agents/tier-override) and
-- sub-agent promotion (app/api/agent/promote-subagent).

CREATE OR REPLACE FUNCTION public.fn_sync_tier_lock_on_tier_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_level int;
  v_tier_set boolean;
  v_markup_set boolean;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_tier_set   := NEW.tier IS NOT NULL;
    v_markup_set := NEW.custom_markup_override IS NOT NULL;
  ELSE
    v_tier_set   := NEW.tier IS DISTINCT FROM OLD.tier
                    AND NEW.tier IS NOT NULL;
    v_markup_set := NEW.custom_markup_override IS DISTINCT FROM OLD.custom_markup_override
                    AND NEW.custom_markup_override IS NOT NULL;
  END IF;

  IF v_tier_set THEN
    v_level := NULLIF(regexp_replace(NEW.tier::text, '\D', '', 'g'), '')::int;
    IF v_level IS NOT NULL THEN
      NEW.locked_tier_level      := v_level;
      NEW.fixed_scale_override   := true;
      NEW.house_tier_level       := v_level;
      NEW.custom_markup_override := NULL;
    END IF;

  ELSIF v_markup_set THEN
    NEW.tier                 := NULL;
    NEW.locked_tier_level    := NULL;
    NEW.fixed_scale_override := false;

  ELSIF NEW.tier IS NOT NULL AND NEW.custom_markup_override IS NULL THEN
    v_level := NULLIF(regexp_replace(NEW.tier::text, '\D', '', 'g'), '')::int;
    IF v_level IS NOT NULL THEN
      NEW.locked_tier_level    := v_level;
      NEW.fixed_scale_override := true;
      NEW.house_tier_level     := v_level;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Fire on INSERT as well as on any write that could break the invariant.
-- (Previously BEFORE UPDATE OF tier -- which is exactly why inserts drifted.)
DROP TRIGGER IF EXISTS trg_sync_tier_lock_on_tier_change ON public.profiles;
CREATE TRIGGER trg_sync_tier_lock_on_tier_change
BEFORE INSERT OR UPDATE OF tier, custom_markup_override, locked_tier_level,
                           fixed_scale_override, house_tier_level
ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.fn_sync_tier_lock_on_tier_change();

-- Repair existing drift, limited to rows where it CANNOT move money: parented
-- (chain-priced) accounts, whose own custom_markup_override is already ignored
-- by lib/pricing and fn_agent_chain_cost (their cost is top-of-chain compounded
-- by each hop's commission_pct). Re-touching `tier` runs the invariant above,
-- which applies the lock and drops the dead override.
-- Top-level accounts whose displayed tier is masked by a flat markup are left
-- untouched on purpose: clearing the override there would change a live selling
-- price, so it stays an explicit operator decision (re-picking the tier in the
-- admin UI now applies cleanly).
UPDATE public.profiles SET tier = tier
WHERE role IN ('agent','super_agent')
  AND COALESCE(is_sub_agent,false) = false
  AND parent_agent_id IS NOT NULL
  AND tier IS NOT NULL
  AND (custom_markup_override IS NOT NULL
       OR locked_tier_level IS NULL
       OR fixed_scale_override IS DISTINCT FROM true);
