-- ============================================================================
-- Automated Sub-Agent Orphan Cleanup Trigger
-- ============================================================================

-- When a Super Agent is banned, automatically emancipate their sub-agents
-- so they become independent agents attached directly to the House, rather
-- than being trapped under a banned account.

CREATE OR REPLACE FUNCTION public.fn_emancipate_sub_agents_on_ban()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- If this agent was just deactivated/banned
  IF (OLD.is_active IS DISTINCT FROM NEW.is_active AND NEW.is_active = false) THEN
    
    -- Emancipate all of their sub-agents
    UPDATE public.profiles 
    SET 
      is_sub_agent = false, 
      parent_agent_id = NULL
    WHERE parent_agent_id = NEW.id;
    
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_emancipate_sub_agents_on_ban ON public.profiles;
CREATE TRIGGER trg_emancipate_sub_agents_on_ban
  AFTER UPDATE OF is_active ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.fn_emancipate_sub_agents_on_ban();
