-- Top-level agents created by an admin have no super-agent parent, but they
-- can still have a custom gamification ladder. sub_agent_commission_plan was
-- designed for sub-agent -> parent relationships (parent_agent_id NOT NULL).
-- Relax that so a custom ladder can be stored for a top-level agent with a
-- NULL parent. fn_agent_effective_markup looks up steps by sub_agent_id only,
-- so a NULL parent does not affect markup resolution.
ALTER TABLE public.sub_agent_commission_plan
  ALTER COLUMN parent_agent_id DROP NOT NULL;
