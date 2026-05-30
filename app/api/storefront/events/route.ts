import { NextResponse, type NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { rateLimit } from '@/lib/rate-limit';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const EventSchema = z.object({
  agent_slug: z.string().min(1).max(80),
  event_type: z.enum(['pageview','product_view','search','add_to_cart','checkout_start','order_complete']),
  session_id: z.string().min(8).max(80),
  path: z.string().max(200).optional(),
  search_term: z.string().max(120).optional(),
  product_id: z.string().uuid().optional(),
  order_id: z.string().uuid().optional(),
  amount_cents: z.number().int().nonnegative().optional(),
  user_agent: z.string().max(240).optional(),
});

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const limited = await rateLimit({
    key: 'storefront_events',
    identifier: ip,
    limit: 240,
    windowSeconds: 60,
  });
  if (!limited.allowed) return NextResponse.json({ error: 'rate_limited' }, { status: 429 });

  let body: unknown;
  try {
    const text = await req.text();
    body = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }
  const parsed = EventSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'invalid_body' }, { status: 400 });

  const svc = await createServiceClient();
  const { data: agent } = await svc
    .from('agent_profiles')
    .select('id')
    .eq('slug', parsed.data.agent_slug)
    .maybeSingle();
  if (!agent) {
    return new Response(null, { status: 204 });
  }

  await svc.from('agent_storefront_events').insert({
    agent_id: agent.id,
    visitor_id: null,
    session_id: parsed.data.session_id,
    event_type: parsed.data.event_type,
    path: parsed.data.path ?? null,
    search_term: parsed.data.search_term ?? null,
    product_id: parsed.data.product_id ?? null,
    order_id: parsed.data.order_id ?? null,
    amount_cents: parsed.data.amount_cents ?? null,
    user_agent: parsed.data.user_agent ?? null,
  });

  return new Response(null, { status: 204 });
}
