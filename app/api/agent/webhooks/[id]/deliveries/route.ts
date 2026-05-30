import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { requireAgent } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const gate = await requireAgent();
  if (!gate.ok) return gate.response;

  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: 'Id Required' }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const service = await createServiceClient();
  const { data: endpoint } = await service
    .from('webhook_endpoints')
    .select('id, owner_id, owner_type')
    .eq('id', id)
    .maybeSingle();

  if (!endpoint) return NextResponse.json({ error: 'Not Found' }, { status: 404 });
  if (endpoint.owner_type !== 'agent' || endpoint.owner_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data: deliveries, error } = await service
    .from('webhook_deliveries')
    .select('id, event_type, status, attempts, next_attempt_at, last_status_code, last_attempted_at, delivered_at, created_at, related_order_id')
    .eq('endpoint_id', id)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  return NextResponse.json({ deliveries: deliveries ?? [] });
}
