import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const url = new URL(req.url);
  const q = url.searchParams.get('q');
  const action = url.searchParams.get('action');
  const cursor = url.searchParams.get('cursor');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 200);

  const svc = await createServiceClient();
  let query = svc
    .from('admin_audit_log')
    .select('id, actor_id, actor_email, action, target_type, target_id, summary, metadata, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (q) query = query.ilike('summary', `%${q}%`);
  if (action) query = query.eq('action', action);
  if (cursor) query = query.lt('created_at', cursor);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}
