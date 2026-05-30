import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: 'Id Required' }, { status: 400 });

  const service = await createServiceClient();
  const { data: endpoint } = await service
    .from('webhook_endpoints')
    .select('id, name, url, owner_type, owner_id, is_active, failure_count, last_failure_at, last_failure_reason, last_success_at, created_at, event_types')
    .eq('id', id)
    .maybeSingle();

  if (!endpoint) return NextResponse.json({ error: 'Not Found' }, { status: 404 });

  const { data: deliveries, error } = await service
    .from('webhook_deliveries')
    .select('id, event_type, status, attempts, next_attempt_at, last_status_code, last_response_body, last_attempted_at, delivered_at, created_at, related_order_id')
    .eq('endpoint_id', id)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  return NextResponse.json({ endpoint, deliveries: deliveries ?? [] });
}
