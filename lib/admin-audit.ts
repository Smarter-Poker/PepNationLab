// Shared writer for admin_audit_log.
//
// The admin routes historically inlined their own best-effort
// `supabase.from('admin_audit_log').insert({...})` calls, which meant several
// sensitive money/role/pricing routes silently shipped with NO audit row while
// comparable routes logged. This helper centralizes the insert so every
// sensitive admin mutation records a uniform, forensically-useful row, and so
// an audit-write failure can never bubble up and mask a committed mutation.
//
// admin_audit_log columns: actor_id, action, entity_type, entity_id, changes (jsonb).

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AuditClient = { from: (t: string) => any };

export interface AuditEntry {
  actorId: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  changes?: Record<string, unknown> | null;
}

/**
 * Best-effort insert of one admin_audit_log row. Never throws: an audit-log
 * outage must not break (or appear to break) the action being audited. Callers
 * should `await` it AFTER the mutation has committed.
 */
export async function writeAuditLog(
  client: AuditClient,
  entry: AuditEntry,
): Promise<void> {
  try {
    await client.from('admin_audit_log').insert({
      actor_id: entry.actorId,
      action: entry.action,
      entity_type: entry.entityType,
      entity_id: entry.entityId,
      changes: entry.changes ?? null,
    });
  } catch {
    // Intentionally swallowed - audit failures must not affect the request.
  }
}
