import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';

export const dynamic = 'force-dynamic';

const VALID_EVENTS = [
  'order.created',
  'order.approved',
  'order.shipped',
  'order.delivered',
  'order.cancelled',
  'subscription.run',
  'price.changed',
] as const;

const CreateSchema = z.object({
  name: z.string().min(1).max(120),
  url: z.string().url().refine((v) => v.startsWith('https://'), 'URL Must Start With https://'),
  event_types: z.array(z.enum(VALID_EVENTS)).min(1).max(20),
});

export async function GET(req: NextRequest) {
  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const url = req.nextUrl;
  const ownerType = url.searchParams.get('owner_type');
  const page = Math.max(1, Number(url.searchParams.get('page') ?? 1));
  const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get('page_size') ?? 25)));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const service = await createServiceClient();
  let query = service
    .from('webhook_endpoints')
    .select('id, owner_type, owner_id, name, url, event_types, is_active, failure_count, last_failure_at, last_failure_reason, last_success_at, created_at, updated_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (ownerType === 'admin' || ownerType === 'agent') {
    query = query.eq('owner_type', ownerType);
  }

  const { data, count, error } = await query;
  if (error) return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });

  return NextResponse.json({
    endpoints: data ?? [],
    page,
    page_size: pageSize,
    total: count ?? 0,
  });
}

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const body = await req.json().catch(() => ({}));
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid Webhook Payload', details: parsed.error.issues }, { status: 400 });
  }

  const secret = crypto.randomBytes(24).toString('hex');

  const service = await createServiceClient();
  const { data, error } = await service
    .from('webhook_endpoints')
    .insert({
      owner_type: 'admin',
      owner_id: null,
      name: parsed.data.name,
      url: parsed.data.url,
      secret,
      event_types: parsed.data.event_types,
      is_active: true,
    })
    .select('id, name, url, event_types, is_active, created_at')
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message || 'Failed To Create Webhook' }, { status: 500 });
  }

  await service.from('admin_audit_log').insert({
    actor_id: gate.userId,
    action: 'webhook_endpoint_created',
    entity_type: 'webhook_endpoint',
    entity_id: data.id,
    changes: { name: data.name, url: data.url, owner_type: 'admin' },
  });

  return NextResponse.json({ endpoint: data, secret });
}

export async function DELETE(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const id = req.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Id Required' }, { status: 400 });

  const service = await createServiceClient();
  const { error } = await service
    .from('webhook_endpoints')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });

  await service.from('admin_audit_log').insert({
    actor_id: gate.userId,
    action: 'webhook_endpoint_disabled',
    entity_type: 'webhook_endpoint',
    entity_id: id,
    changes: {},
  });

  return NextResponse.json({ ok: true });
}
