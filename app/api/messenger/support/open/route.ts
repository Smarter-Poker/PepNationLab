
import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { getEffectiveUser } from '@/lib/impersonation';
import { assertSameOrigin } from '@/lib/csrf';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import { z } from 'zod';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z.object({
  topic: z.string().trim().max(120).optional(),
  orderId: z.string().uuid().optional(),
}).partial();

/**
 * Find-or-create the user's support conversation with admin.
 * Accepts an optional pre-chat topic + order context, both of which are
 * persisted onto messenger_conversations so the admin sees them at a glance.
 */
export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const supabase = await createClient();
  const { data: { user } } = await getEffectiveUser(supabase);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const ip = getClientIp(req);
  const limited = await rateLimit({
    key: 'messenger_support_open',
    limit: 20,
    windowSeconds: 60,
    identifier: user.id || ip,
  });
  if (!limited.allowed) return NextResponse.json({ error: 'Rate Limit Exceeded' }, { status: 429 });

  let parsed: z.infer<typeof Body> = {};
  try {
    const raw = await req.json().catch(() => ({}));
    parsed = Body.parse(raw ?? {});
  } catch { parsed = {}; }

  const svc = await createServiceClient();

  // If orderId provided, verify it belongs to this user.
  let orderId: string | null = null;
  if (parsed.orderId) {
    const { data: ord } = await svc
      .from('orders')
      .select('id, buyer_id')
      .eq('id', parsed.orderId)
      .maybeSingle();
    if (ord && ord.buyer_id === user.id) orderId = ord.id;
  }

  const { data, error } = await svc.rpc('fn_messenger_support_open', {
    p_user_id: user.id,
    p_topic: parsed.topic ?? null, // @ts-ignore
    p_order_id: orderId, // @ts-ignore
  });
  if (error || !data) {
    console.error('[support/open]', error);
    return NextResponse.json({ error: 'Failed To Open Support' }, { status: 500 });
  }

  return NextResponse.json({ conversationId: data });
}
