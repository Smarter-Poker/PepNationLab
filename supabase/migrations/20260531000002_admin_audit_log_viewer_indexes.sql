-- 20260531000002_admin_audit_log_viewer_indexes.sql
--
-- The admin audit-log viewer (GET /api/admin/audit, /admin/audit) orders by
-- created_at DESC with a created_at cursor and optionally filters by action.
-- admin_audit_log previously had only its primary-key index, so every viewer
-- load was a full sequential scan + in-memory sort. The table accrues a row on
-- every sensitive admin action, so this degrades over time. Add covering
-- indexes for the order/cursor and the action filter.

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created_at
  ON public.admin_audit_log (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_action_created_at
  ON public.admin_audit_log (action, created_at DESC);
