import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

// admin_audit_log real columns: id, actor_id, action, entity_type, entity_id,
// changes (jsonb), ip_address, user_agent, created_at. The viewer presents a
// derived `summary` (compact changes) and resolves actor_email from profiles.
function summarize(changes: unknown): string | null {
  if (changes == null) return null;
  try {
    const s = JSON.stringify(changes);
    return s.length > 160 ? `${s.slice(0, 157)}…` : s;
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const url = new URL(req.url);
  // Sanitize free-text search before interpolating into a PostgREST .or() filter.
  const q = (url.searchParams.get('q') || '').replace(/[%,():"'\\]/g, '').trim().slice(0, 60);
  const action = url.searchParams.get('action');
  const cursor = url.searchParams.get('cursor');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 200);

  const svc = await createServiceClient();
  let query = svc
    .from('admin_audit_log')
    .select('id, actor_id, action, entity_type, entity_id, changes, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (q) query = query.or(`action.ilike.%${q}%,entity_type.ilike.%${q}%,entity_id.ilike.%${q}%`);
  if (action) query = query.eq('action', action);
  if (cursor) query = query.lt('created_at', cursor);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });

  const rows = data ?? [];

  // Resolve actor emails in a single batch lookup (admin_audit_log stores only actor_id).
  const actorIds = Array.from(new Set(rows.map((r) => r.actor_id).filter(Boolean))) as string[];
  const emailMap: Record<string, string> = {};
  if (actorIds.length > 0) {
    const { data: actors } = await svc.from('profiles').select('id, email').in('id', actorIds);
    for (const a of actors ?? []) emailMap[a.id] = a.email;
  }

  const mapped = rows.map((r) => ({
    id: r.id,
    actor_id: r.actor_id,
    actor_email: r.actor_id ? emailMap[r.actor_id] ?? null : null,
    action: r.action,
    target_type: r.entity_type,
    target_id: r.entity_id,
    summary: summarize(r.changes),
    metadata: (r.changes as Record<string, unknown> | null) ?? null,
    created_at: r.created_at,
  }));

  return NextResponse.json({ data: mapped });
}
