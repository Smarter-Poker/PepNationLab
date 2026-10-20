-- Child RLS does not inherit parent permissions through its foreign key.
-- All existing permissive policies must be replaced, since they combine with OR.
BEGIN;
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '15s';
DO $$
BEGIN
  IF to_regclass('public.message_reactions') IS NULL OR to_regclass('public.internal_messages') IS NULL THEN
    RAISE EXCEPTION 'Reaction or parent table missing';
  END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.message_reactions'::regclass)
    OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.internal_messages'::regclass) THEN
    RAISE EXCEPTION 'Expected reaction and parent RLS';
  END IF;
  IF (SELECT count(*) FROM pg_attribute WHERE attrelid='public.message_reactions'::regclass
      AND NOT attisdropped AND ((attname IN ('message_id','user_id') AND atttypid='uuid'::regtype) OR (attname='emoji' AND atttypid='text'::regtype))) <> 3
    OR (SELECT count(*) FROM pg_attribute WHERE attrelid='public.internal_messages'::regclass
      AND NOT attisdropped AND attname IN ('id','sender_id','receiver_id') AND atttypid='uuid'::regtype) <> 3 THEN
    RAISE EXCEPTION 'Unexpected reaction or parent columns';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policy WHERE polrelid='public.message_reactions'::regclass AND
    (polname,polcmd::text) NOT IN (
      ('Participants can view reactions','r'), ('Users can view reactions','r'),
      ('Users can add reactions','a'), ('Users can manage own reactions','*'),
      ('Users can read reactions on their messages','r'), ('Users can remove own reactions','d')
    )) THEN
    RAISE EXCEPTION 'Unexpected reaction policy drift';
  END IF;
END $$;
CREATE TEMP TABLE reaction_access_preimage_20261020 ON COMMIT DROP AS
  SELECT relacl::text AS acl, relowner, relrowsecurity, relforcerowsecurity
  FROM pg_class WHERE oid='public.message_reactions'::regclass;
DO $$
DECLARE existing record;
BEGIN
  FOR existing IN SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'message_reactions'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.message_reactions', existing.policyname);
  END LOOP;
END $$;
CREATE POLICY message_reactions_participant_read ON public.message_reactions
FOR SELECT TO authenticated USING (
  public.is_admin() OR EXISTS (
    SELECT 1 FROM public.internal_messages m WHERE m.id = message_reactions.message_id
      AND (m.sender_id = (SELECT auth.uid()) OR m.receiver_id = (SELECT auth.uid()))
  )
);
CREATE POLICY message_reactions_participant_insert ON public.message_reactions
FOR INSERT TO authenticated WITH CHECK (
  user_id = (SELECT auth.uid()) AND EXISTS (
    SELECT 1 FROM public.internal_messages m WHERE m.id = message_reactions.message_id
      AND (m.sender_id = (SELECT auth.uid()) OR m.receiver_id = (SELECT auth.uid()))
  )
);
CREATE POLICY message_reactions_participant_update ON public.message_reactions
FOR UPDATE TO authenticated USING (
  user_id = (SELECT auth.uid()) AND EXISTS (
    SELECT 1 FROM public.internal_messages m WHERE m.id = message_reactions.message_id
      AND (m.sender_id = (SELECT auth.uid()) OR m.receiver_id = (SELECT auth.uid()))
  )
) WITH CHECK (
  user_id = (SELECT auth.uid()) AND EXISTS (
    SELECT 1 FROM public.internal_messages m WHERE m.id = message_reactions.message_id
      AND (m.sender_id = (SELECT auth.uid()) OR m.receiver_id = (SELECT auth.uid()))
  )
);
CREATE POLICY message_reactions_participant_delete ON public.message_reactions
FOR DELETE TO authenticated USING (
  user_id = (SELECT auth.uid()) AND EXISTS (
    SELECT 1 FROM public.internal_messages m WHERE m.id = message_reactions.message_id
      AND (m.sender_id = (SELECT auth.uid()) OR m.receiver_id = (SELECT auth.uid()))
  )
);
DO $$
BEGIN
  IF EXISTS (
    (SELECT relacl::text,relowner,relrowsecurity,relforcerowsecurity FROM pg_class WHERE oid='public.message_reactions'::regclass
     EXCEPT SELECT * FROM reaction_access_preimage_20261020)
  ) THEN RAISE EXCEPTION 'Reaction ACL or table metadata changed'; END IF;
  IF (SELECT count(*) FROM pg_policy WHERE polrelid='public.message_reactions'::regclass) <> 4
    OR EXISTS (SELECT 1 FROM pg_policy WHERE polrelid='public.message_reactions'::regclass AND
      (polname,polcmd::text) NOT IN (
        ('message_reactions_participant_read','r'), ('message_reactions_participant_insert','a'),
        ('message_reactions_participant_update','w'), ('message_reactions_participant_delete','d')
      )) THEN RAISE EXCEPTION 'Reaction policy postflight failed'; END IF;
END $$;
COMMIT;
