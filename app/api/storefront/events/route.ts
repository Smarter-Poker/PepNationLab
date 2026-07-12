import { NextResponse, type NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import { z } from 'zod';
import { assertSameOrigin } from '@/lib/csrf';

export const dynamic = 'force-dynamic';

// Client-emittable events only. Revenue and lifecycle events (order_complete,
// order_cancelled, signup) are emitted SERVER-side by their owning API routes
// (lib/server-analytics.ts) so they can neither be lost to ad blockers nor
// forged with arbitrary amounts by anonymous POSTs.
const EventSchema = z.object({
  agent_slug: z.string().min(1).max(80),
  event_type: z.enum(['pageview','product_view','search','add_to_cart','remove_from_cart','checkout_start']),
  session_id: z.string().min(8).max(80),
  visitor_id: z.string().uuid().optional(),
  path: z.string().max(200).optional(),
  search_term: z.string().max(120).optional(),
  product_id: z.string().uuid().optional(),
  quantity: z.number().int().positive().max(100000).optional(),
  amount_cents: z.number().int().nonnegative().max(100000000).optional(),
  user_agent: z.string().max(240).optional(),
});

const MAX_BODY_BYTES = 4096;

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const ip = getClientIp(req);
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
    if (text.length > MAX_BODY_BYTES) {
      return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
    }
    body = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }
  const parsed = EventSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'invalid_body' }, { status: 400 });

  try {
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
      visitor_id: parsed.data.visitor_id ?? null,
      session_id: parsed.data.session_id,
      event_type: parsed.data.event_type,
      path: parsed.data.path ?? null,
      search_term: parsed.data.search_term ?? null,
      product_id: parsed.data.product_id ?? null,
      quantity: parsed.data.quantity ?? null,
      amount_cents: parsed.data.amount_cents ?? null,
      user_agent: parsed.data.user_agent ?? null,
    });

    return new Response(null, { status: 204 });
  } catch (err) {
    console.error('[storefront/events] POST error:', err);
    // Best-effort analytics - return 204 so the client does not retry endlessly.
    return new Response(null, { status: 204 });
  }
}
