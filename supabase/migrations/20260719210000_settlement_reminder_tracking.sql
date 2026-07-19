-- Duplicate of 20260719190000_settlement_reminder_tracking.sql (same DDL was
-- authored twice during the 2026-07-19 settlement build). The 190000 file is
-- canonical; this one is intentionally a no-op. Both are idempotent
-- (IF NOT EXISTS) and the columns are already live in production.
SELECT 1;
