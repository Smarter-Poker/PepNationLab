import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
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
  'subscription.run',
  'price.changed',
] as const;

const CreateSchema = z.object({
  name: z.string().min(1).max(120),
  url: z.string().url().refine((v) => v.startsWith('https://'), 'URL Must Start With https://'),
  event_types: z.array(z.enum(VALID_EVENTS)).min(1).max(20),
});

export async function GET() {
  const gate = await requireAgent();
  if (!gate.ok) return gate.response;

  const service = await createServiceClient();
  const { data, error } = await service
    .from('webhook_endpoints')
    .select('id, name, url, event_types, is_active, failure_count, last_failure_at, last_failure_reason, last_success_at, created_at, updated_at')
    .eq('owner_type', 'agent')
    .eq('owner_id', gate.user.id)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  return NextResponse.json({ endpoints: data ?? [] });
}

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const gate = await requireAgent();
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
      owner_type: 'agent',
      owner_id: gate.user.id,
      name: parsed.data.name,
      url: parsed.data.url,
      secret,
      event_types: parsed.data.event_types,
      is_active: true,
    })
    .select('id, name, url, event_types, is_active, created_at')
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }

  // Return the secret ONCE on creation. The agent must save it now.
  return NextResponse.json({ endpoint: data, secret });
}
