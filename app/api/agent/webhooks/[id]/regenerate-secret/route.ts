import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { requireAgent } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';

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
    .select('id, owner_id, owner_type, name')
    .eq('id', id)
    .maybeSingle();

  if (!endpoint) return NextResponse.json({ error: 'Not Found' }, { status: 404 });
  if (endpoint.owner_type !== 'agent' || endpoint.owner_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const secret = crypto.randomBytes(24).toString('hex');
  const { error } = await service
    .from('webhook_endpoints')
    .update({ secret, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Audit so we can see who rotated which secret.
  await service.from('admin_audit_log').insert({
    actor_id: user.id,
    action: 'webhook_secret_regenerated',
    entity_type: 'webhook_endpoint',
    entity_id: id,
    changes: { endpoint_name: endpoint.name },
  });

  return NextResponse.json({ secret });
}
