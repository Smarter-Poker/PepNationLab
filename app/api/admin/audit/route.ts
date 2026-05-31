import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { createServiceClient } from '@/lib/supabase/server';
import { mapAuditRows } from '@/lib/audit-map';

export const dynamic = 'force-dynamic';

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

  return NextResponse.json({ data: mapAuditRows(rows, emailMap) });
}
