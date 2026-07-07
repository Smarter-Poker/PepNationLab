-- Security hardening pass (2026-07-07)
--
-- 1) Remove permissive SELECT policies on tables the application only ever
--    accesses through the service-role client (verified in code):
--    - message_reactions:        read/written via app/api/messages/reactions (service client)
--    - shared_research_protocols: read via server page + insert via API (service client)
--    - messenger_link_previews:  read/upserted via app/api/messenger/link-preview (service client)
--    Their anon/authenticated read policies were pure unused attack surface:
--    anyone with the anon key could enumerate all reactions (social graph),
--    all shared protocol payloads, and the link-preview cache via PostgREST.
--
-- 2) message_reactions keeps a properly scoped SELECT for any future direct
--    client reads: reaction owner, participants of the underlying message,
--    or admin.
--
-- 3) Pin search_path on the 19 functions flagged by the Supabase linter
--    (function_search_path_mutable). All are invoker-rights trigger/utility
--    helpers; pinning to `public` preserves resolution (pg_trgm and vector
--    are installed in public) while preventing search-path hijack.

-- ── 1. message_reactions ─────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can view reactions" ON public.message_reactions;

CREATE POLICY "Participants can view reactions"
ON public.message_reactions
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.internal_messages m
    WHERE m.id = message_reactions.message_id
      AND (m.sender_id = auth.uid() OR m.receiver_id = auth.uid())
  )
  OR public.is_admin()
);

-- ── 2. shared_research_protocols ─────────────────────────────────────
-- Share links resolve server-side with the service client; no client read
-- path exists. Removing the public SELECT stops anon-key enumeration of all
-- shared payloads while leaving share pages fully functional.
DROP POLICY IF EXISTS "Anyone can view shared protocols" ON public.shared_research_protocols;

-- ── 3. messenger_link_previews ─────────────────────────────────────────
DROP POLICY IF EXISTS "mlp_select_authenticated" ON public.messenger_link_previews;

-- ── 4. Pin search_path on linter-flagged functions ─────────────────────────
DO $$
DECLARE
  fn record;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'
      AND p.proname IN (
        'payment_proof_order_id',
        'refresh_compound_quality_score',
        'compute_compound_quality_score',
        'guarded_function_lock_key',
        'lock_guarded_function',
        'record_function_rewrite',
        'tg_admin_shadow_notes_touch_updated',
        'tg_cart_recovery_variants_touch',
        'slugify_for_storefront',
        'trg_agent_profiles_stamp_renamed',
        'fn_house_default_commission_steps',
        'compounds_set_updated_at',
        'enforce_name_capitalization_trigger',
        'enforce_profile_name_capitalization_trigger',
        'update_researcher_notes_updated_at',
        'match_products_vector',
        'capitalize_words_preserve_case',
        'touch_course_progress',
        'compound_references_default_ref_type'
      )
      AND (p.proconfig IS NULL OR NOT EXISTS (
        SELECT 1 FROM unnest(p.proconfig) c WHERE c LIKE 'search_path=%'
      ))
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public', fn.sig);
  END LOOP;
END $$;
