import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { requireAgent } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';

export const dynamic = 'force-dynamic';

const VALID_EVENTS = [
  'order.created',
  'order.approved',
  'order.shipped',
  'order.delivered',
  'order.cancelled',
  'order.refunded',
  'rma.created',
  'rma.resolved',
  'subscription.run',
  'price.changed',
] as const;

const PatchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  url: z.string().url().refine((v) => v.startsWith('https://'), 'URL Must Start With https://').optional(),
  event_types: z.array(z.enum(VALID_EVENTS)).min(1).max(20).optional(),
  is_active: z.boolean().optional(),
});

async function authOwn(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };

  const service = await createServiceClient();
  const { data: endpoint } = await service
    .from('webhook_endpoints')
    .select('id, owner_id, owner_type')
    .eq('id', id)
    .maybeSingle();

  if (!endpoint) {
    return { ok: false as const, response: NextResponse.json({ error: 'Not Found' }, { status: 404 }) };
  }
  if (endpoint.owner_type !== 'agent' || endpoint.owner_id !== user.id) {
    return { ok: false as const, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { ok: true as const, userId: user.id, service };
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const gate = await requireAgent();
  if (!gate.ok) return gate.response;

  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: 'Id Required' }, { status: 400 });

  const own = await authOwn(id);
  if (!own.ok) return own.response;

  const body = await req.json().catch(() => ({}));
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid Webhook Update', details: parsed.error.issues }, { status: 400 });
  }
  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: 'No Changes Provided' }, { status: 400 });
  }

  const update: Record<string, unknown> = { ...parsed.data, updated_at: new Date().toISOString() };

  const { data, error } = await own.service
    .from('webhook_endpoints')
    .update(update)
    .eq('id', id)
    .select('id, name, url, event_types, is_active, failure_count, last_failure_at, last_failure_reason, last_success_at, created_at, updated_at')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ endpoint: data });
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const gate = await requireAgent();
  if (!gate.ok) return gate.response;

  const { id } = await ctx.params;
  if (!id) return NextResponse.json({ error: 'Id Required' }, { status: 400 });

  const own = await authOwn(id);
  if (!own.ok) return own.response;

  // Soft delete (disable). Hard delete handled by admin override route.
  const { error } = await own.service
    .from('webhook_endpoints')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
