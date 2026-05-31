-- ============================================================
-- notifications_replica_identity.sql
-- Set REPLICA IDENTITY FULL to ensure payload.old is populated for realtime updates
-- ============================================================

ALTER TABLE public.notifications REPLICA IDENTITY FULL;
