// Shared mapping for the admin audit-log viewer.
//
// admin_audit_log stores: id, actor_id, action, entity_type, entity_id,
// changes (jsonb), created_at. The viewer presents a flattened row with a
// derived `summary` and a resolved `actor_email`. This lives in one place so
// the server page (app/admin/audit/page.tsx) and the load-more API route
// (app/api/admin/audit/route.ts) cannot drift apart.

export interface RawAuditRow {
  id: string;
  actor_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  changes: unknown;
  created_at: string;
}

export interface MappedAuditRow {
  id: string;
  actor_id: string | null;
  actor_email: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  summary: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export function summarizeAuditChanges(changes: unknown): string | null {
  if (changes == null) return null;
  try {
    const s = JSON.stringify(changes);
    return s.length > 160 ? `${s.slice(0, 157)}…` : s;
  } catch {
    return null;
  }
}

export function mapAuditRows(
  rows: RawAuditRow[],
  emailMap: Record<string, string>,
): MappedAuditRow[] {
  return rows.map((r) => ({
    id: r.id,
    actor_id: r.actor_id,
    actor_email: r.actor_id ? emailMap[r.actor_id] ?? null : null,
    action: r.action,
    target_type: r.entity_type,
    target_id: r.entity_id,
    summary: summarizeAuditChanges(r.changes),
    metadata: (r.changes as Record<string, unknown> | null) ?? null,
    created_at: r.created_at,
  }));
}
