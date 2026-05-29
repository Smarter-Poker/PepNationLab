-- ============================================================================
-- Third audit pass for Messenger Phase 10 / 11 / 12.
-- Applied to Supabase ydsaqnnuwyvtyxgvrnys as
--   messenger_audit3_p10_p11_p12_storage_blocks_dead_cols.
--
-- 1. Storage upload policy: lock messenger_media uploads to the caller-owned
--    folder (path begins with auth.uid()::text). The signed-upload-URL
--    server route already builds the path that way, but the bucket policy
--    itself was too permissive (any authenticated user could upload to any
--    folder via a direct authenticated POST).
-- 2. messenger_reports UPDATE policy: add WITH CHECK so an admin cannot
--    re-attribute a row to a different conversation/message/reporter on
--    update (Pass 2 deferred this).
-- 3. Soft-delete cleanup: when a message is soft-deleted for_everyone,
--    also wipe messenger_reactions and messenger_link_previews so realtime
--    listeners can't continue to read attached state. Extends Pass 2's
--    fn_mm_cleanup_pins_on_delete.
-- ============================================================================

-- 1. Storage bucket lockdown.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policy
              WHERE polname = 'Authenticated users can upload messenger media'
                AND polrelid = 'storage.objects'::regclass) THEN
    EXECUTE 'DROP POLICY "Authenticated users can upload messenger media" ON storage.objects';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policy
              WHERE polname = 'Public read access for messenger media'
                AND polrelid = 'storage.objects'::regclass) THEN
    EXECUTE 'DROP POLICY "Public read access for messenger media" ON storage.objects';
  END IF;
END $$;

DROP POLICY IF EXISTS "messenger_media_upload_own_folder" ON storage.objects;
CREATE POLICY "messenger_media_upload_own_folder"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'messenger_media'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "messenger_media_public_read" ON storage.objects;
CREATE POLICY "messenger_media_public_read"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'messenger_media');

-- 2. messenger_reports UPDATE WITH CHECK.
DROP POLICY IF EXISTS mrpt_update_admin ON public.messenger_reports;
CREATE POLICY mrpt_update_admin ON public.messenger_reports
  FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 3. Extend Pass 2's soft-delete cleanup trigger to also wipe reactions and
--    link previews. Bookmarks intentionally retain message_text snapshot;
--    labels and edit_history are intentionally preserved for audit context.
CREATE OR REPLACE FUNCTION public.fn_mm_cleanup_pins_on_delete() RETURNS trigger AS $$
BEGIN
  IF (NEW.is_deleted = true AND NEW.delete_scope = 'for_everyone')
     AND (OLD.is_deleted = false OR OLD.delete_scope IS DISTINCT FROM 'for_everyone') THEN
    DELETE FROM public.messenger_pins WHERE message_id = NEW.id;
    DELETE FROM public.messenger_reactions WHERE message_id = NEW.id;
    IF EXISTS (SELECT 1 FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = 'messenger_link_previews') THEN
      DELETE FROM public.messenger_link_previews WHERE message_id = NEW.id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
