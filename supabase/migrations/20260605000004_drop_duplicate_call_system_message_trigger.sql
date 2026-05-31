-- ============================================================================
-- audit15 SECONDARY pass finding: trg_messenger_calls_after_update was inserting
-- a SECOND system message on every terminal call transition while the route
-- handlers (POST /api/messenger/call-signal) and cron (mark-missed-calls)
-- already insert one. Net result: every call termination produced 2 (sometimes
-- 3) system messages in the chat. The trigger also writes lowercase strings
-- ("Missed video call", "video call ended — 1m 23s") which violates the
-- PepNationLab Title Case platform rule in CLAUDE.md.
--
-- Route handlers + cron are the authoritative source for system messages.
-- They emit Title-Case strings and carry richer metadata (metadata.status =
-- 'declined' | 'ended_before_answer' | 'ended' | 'missed_timeout'). Dropping
-- the trigger and its backing function eliminates the duplicate and the
-- formatting violation in one shot.
--
-- No data migration needed — existing duplicate system messages remain in
-- conversation history but no new duplicates will be produced.
-- ============================================================================

DROP TRIGGER IF EXISTS trg_messenger_calls_after_update ON public.messenger_calls;
DROP FUNCTION IF EXISTS public.fn_messenger_calls_after_update();
