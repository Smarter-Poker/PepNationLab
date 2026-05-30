import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { requireAgent } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';
import { deliverWebhook } from '@/lib/webhook-dispatch';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

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
    .select('id, owner_id, owner_type, is_active')
    .eq('id', id)
    .maybeSingle();

  if (!endpoint) return NextResponse.json({ error: 'Not Found' }, { status: 404 });
  if (endpoint.owner_type !== 'agent' || endpoint.owner_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (!endpoint.is_active) {
    return NextResponse.json({ error: 'Endpoint Is Disabled' }, { status: 400 });
  }

  // Enqueue a test delivery with an immediate next_attempt_at then deliver now.
  const { data: delivery, error: insertErr } = await service
    .from('webhook_deliveries')
    .insert({
      endpoint_id: id,
      event_type: 'webhook.test',
      payload: { message: 'Test Delivery', triggered_by: user.id },
      status: 'pending',
    })
    .select('id')
    .single();

  if (insertErr || !delivery) {
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }

  const result = await deliverWebhook(service, delivery.id);
  return NextResponse.json({
    delivery_id: delivery.id,
    ok: result.ok,
    status_code: result.statusCode ?? null,
    expired: result.expired ?? false,
  });
}
