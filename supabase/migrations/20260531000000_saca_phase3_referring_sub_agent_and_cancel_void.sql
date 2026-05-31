-- ============================================================
-- PEP NATION LAB — SACA Phase 3 + 4
-- Sub-Agent Commission Architecture
--  Phase 3: profiles.referring_sub_agent_id
--  Phase 4: auto-void commission on order cancellation
-- ============================================================
-- Applied to ydsaqnnuwyvtyxgvrnys via Supabase MCP on 2026-05-31.
-- Mirrored here for replay / fresh-clone safety.
-- ============================================================

-- ── 1. profiles.referring_sub_agent_id ──────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referring_sub_agent_id UUID REFERENCES public.profiles(id);

CREATE INDEX IF NOT EXISTS idx_profiles_referring_sub_agent_id
  ON public.profiles (referring_sub_agent_id)
  WHERE referring_sub_agent_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.enforce_referring_sub_agent_is_sub_agent()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_target_is_sub BOOLEAN;
BEGIN
  IF NEW.referring_sub_agent_id IS NOT NULL THEN
    SELECT is_sub_agent INTO v_target_is_sub
    FROM public.profiles
    WHERE id = NEW.referring_sub_agent_id;

    IF v_target_is_sub IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'referring_sub_agent_id % is not flagged is_sub_agent', NEW.referring_sub_agent_id
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.enforce_referring_sub_agent_is_sub_agent() FROM PUBLIC, anon;

DROP TRIGGER IF EXISTS trg_enforce_referring_sub_agent_is_sub_agent ON public.profiles;
CREATE TRIGGER trg_enforce_referring_sub_agent_is_sub_agent
  BEFORE INSERT OR UPDATE OF referring_sub_agent_id ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_referring_sub_agent_is_sub_agent();

-- ── 2. orders: auto-void commission on cancellation ─────────────────────────
CREATE OR REPLACE FUNCTION public.trg_void_subagent_commission_on_cancel()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.status::text = 'cancelled'
     AND OLD.status::text IS DISTINCT FROM NEW.status::text
     AND OLD.status::text NOT IN ('cancelled', 'shipped', 'delivered')
  THEN
    PERFORM public.void_sub_agent_commission(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.trg_void_subagent_commission_on_cancel() FROM PUBLIC, anon;

DROP TRIGGER IF EXISTS trg_void_subagent_commission_on_cancel ON public.orders;
CREATE TRIGGER trg_void_subagent_commission_on_cancel
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW
  WHEN (NEW.status::text = 'cancelled')
  EXECUTE FUNCTION public.trg_void_subagent_commission_on_cancel();
