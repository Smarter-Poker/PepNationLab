-- Audit6 (Phases 12/13): when a messenger_messages row is soft-deleted for
-- everyone, also auto-resolve any messenger_admin_messages row that pointed
-- at it. Prior state: deleting an @admin-mention message left the moderation
-- row unread, polluting the admin inbox with tombstoned entries.
--
-- The trigger fn_mm_cleanup_pins_on_delete already fires on the same flip
-- (is_deleted false -> true with delete_scope = 'for_everyone') and already
-- cleans pins / reactions / link previews. We extend it to also flip the
-- admin-mention row to resolved (no resolver attributed, since the cascade
-- can be triggered by an automated cron OR user soft-delete OR admin delete).
--
-- For admin-initiated deletes, the route also writes resolved_by/resolved_at
-- as a redundant belt-and-braces; the trigger handles the case where no
-- route ran (expire-messages cron, user 'for_everyone' delete in future).

CREATE OR REPLACE FUNCTION public.fn_mm_cleanup_pins_on_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF (NEW.is_deleted = true AND NEW.delete_scope = 'for_everyone')
     AND (OLD.is_deleted = false OR OLD.delete_scope IS DISTINCT FROM 'for_everyone') THEN
    DELETE FROM public.messenger_pins WHERE message_id = NEW.id;
    DELETE FROM public.messenger_reactions WHERE message_id = NEW.id;
    -- Link previews: only delete if the table exists (it's optional).
    IF EXISTS (SELECT 1 FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = 'messenger_link_previews') THEN
      DELETE FROM public.messenger_link_previews WHERE message_id = NEW.id;
    END IF;
    -- Audit6: auto-resolve admin mentions pointing at this tombstoned message.
    IF EXISTS (SELECT 1 FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = 'messenger_admin_messages') THEN
      UPDATE public.messenger_admin_messages
         SET status = 'resolved',
             resolved_at = COALESCE(resolved_at, now()),
             resolution_note = COALESCE(
               resolution_note,
               'Resolved Automatically When Source Message Deleted'
             )
       WHERE message_id = NEW.id
         AND status <> 'resolved';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;
