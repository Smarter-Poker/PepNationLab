-- ============================================================================
-- Database hygiene pass (from Supabase advisor findings; 0 ERROR-level issues).
--
-- 1) Index the FK on client_error_events (introduced with the observability sink).
-- 2) Drop 12 redundant duplicate indexes. Each is identical in columns to a
--    surviving index, so lookups are unaffected -- we only save write + storage
--    overhead. We never drop a PK, a constraint-backed index, or anything in the
--    Supabase-managed auth./storage. schemas.
-- 3) Pin search_path on the three functions flagged as mutable.
--
-- Explicitly NOT done, and why:
--  * rls_enabled_no_policy on shared_research_protocols / social_* / etc. is
--    intentional and correct: those tables are read only via the service role
--    (see app/(storefront)/[agentSlug]/shared/[protocolId]/page.tsx). Adding a
--    public SELECT policy would let anyone enumerate every shared protocol.
--  * unused_index (147) is noise on young, low-traffic tables.
--  * multiple_permissive_policies (461) is a misleading cross-product count and
--    risky to consolidate without a representative test environment.
-- ============================================================================

-- 1) FK index
CREATE INDEX IF NOT EXISTS idx_client_error_events_user_id
  ON public.client_error_events (user_id);

-- 2) Redundant duplicate indexes
DROP INDEX IF EXISTS public.idx_agent_profiles_slug;          -- dup of agent_profiles_slug_key (constraint)
DROP INDEX IF EXISTS public.arg_agent_period_idx;             -- dup of agent_researcher_growth_goals_..._key
DROP INDEX IF EXISTS public.agent_sales_goals_agent_idx;      -- dup of agent_sales_goals_..._key
DROP INDEX IF EXISTS public.idx_wada_compound;                -- dup of compound_wada_history_..._key
DROP INDEX IF EXISTS public.idx_sas_sub_agent;                -- dup of sub_agent_settlements_..._key
DROP INDEX IF EXISTS public.idx_mam_message;                  -- dup of uq_mam_message_id (unique)
DROP INDEX IF EXISTS public.idx_reactions_message;            -- dup of idx_message_reactions_message
DROP INDEX IF EXISTS public.idx_mpin_conv;                    -- dup of idx_mpins_conv
DROP INDEX IF EXISTS public.idx_mrm_user_status;              -- dup of idx_mrem_user_status
DROP INDEX IF EXISTS public.idx_msni_conversation;            -- dup of idx_msin_conv_created
DROP INDEX IF EXISTS public.payment_proofs_order_idx;         -- dup of payment_proofs_order_id_idx
DROP INDEX IF EXISTS public.profiles_username_lower_idx;      -- dup of profiles_username_lower_unique (both unique;
                                                              -- uniqueness stays enforced by the surviving index)

-- 3) Pin search_path. All three reference only built-ins (lower/now/current_setting)
--    or fully schema-qualified objects (public.profiles), so an empty search_path is
--    safe. Verified by firing both profiles triggers on a rolled-back UPDATE.
ALTER FUNCTION public.enforce_lowercase_username() SET search_path = '';
ALTER FUNCTION public.tg_social_touch_updated_at() SET search_path = '';
ALTER FUNCTION public.enforce_researcher_agent_binding() SET search_path = '';
