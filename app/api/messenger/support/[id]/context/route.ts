import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/messenger/support/[id]/context
 * Admin-only. Returns a right-rail context bundle for the support thread:
 * researcher profile, lifetime spend, recent orders (last 5), current cart
 * snapshot, agent of record. Drives the SupportContextSidebar.
 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const svc = await createServiceClient();
  const { data: caller } = await svc.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (caller?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'Invalid Id' }, { status: 400 });

  const { data: conv } = await svc
    .from('messenger_conversations')
    .select('id, support_order_id, support_topic, support_status, support_first_response_at, support_last_researcher_message_at, support_snoozed_until')
    .eq('id', id)
    .eq('is_support', true)
    .maybeSingle();
  if (!conv) return NextResponse.json({ error: 'Conversation Not Found' }, { status: 404 });

  // Resolve the OTHER participant (the researcher)
  const { data: parts } = await svc
    .from('messenger_participants')
    .select('user_id')
    .eq('conversation_id', id);
  const researcherId = (parts ?? []).map((p) => p.user_id as string).find((u) => u !== user.id);
  if (!researcherId) return NextResponse.json({ error: 'Researcher Not Found' }, { status: 404 });

  const { data: prof } = await svc
    .from('profiles')
    .select('id, email, full_name, username, role, created_at, referring_agent_id, parent_agent_id, last_sign_in_at, tier, account_type')
    .eq('id', researcherId)
    .maybeSingle();

  // Recent 5 orders
  const { data: orders } = await svc
    .from('orders')
    .select('id, status, total, subtotal, fulfillment_method, payment_method, coupon_code, tracking_number, created_at')
    .eq('buyer_id', researcherId)
    .order('created_at', { ascending: false })
    .limit(5);

  // Lifetime spend = sum of total for non-cancelled orders
  const { data: ltvRows } = await svc
    .from('orders')
    .select('total, status')
    .eq('buyer_id', researcherId);
  let lifetimeSpend = 0; let lifetimeOrders = 0;
  for (const o of (ltvRows ?? []) as Array<{ total: number | null; status: string | null }>) {
    if (o.status === 'cancelled') continue;
    lifetimeSpend += Number(o.total) || 0;
    lifetimeOrders += 1;
  }

  // Current cart (live)
  const { data: cartRow } = await svc
    .from('profiles')
    .select('cart_state, cart_updated_at')
    .eq('id', researcherId)
    .maybeSingle();

  // Referring agent
  let referringAgent: { id: string; full_name: string | null; username: string | null } | null = null;
  if (prof?.referring_agent_id) {
    const { data: ag } = await svc
      .from('profiles')
      .select('id, full_name, username')
      .eq('id', prof.referring_agent_id)
      .maybeSingle();
    if (ag) referringAgent = ag;
  }

  // Linked order (if conversation tagged one)
  let linkedOrder: { id: string; status: string; total: number; created_at: string; tracking_number: string | null } | null = null;
  if (conv.support_order_id) {
    const { data: lo } = await svc
      .from('orders')
      .select('id, status, total, created_at, tracking_number')
      .eq('id', conv.support_order_id)
      .maybeSingle();
    if (lo) linkedOrder = lo as typeof linkedOrder;
  }

  return NextResponse.json({
    conversation: {
      id: conv.id,
      support_topic: conv.support_topic,
      support_status: conv.support_status,
      support_first_response_at: conv.support_first_response_at,
      support_last_researcher_message_at: conv.support_last_researcher_message_at,
      support_snoozed_until: conv.support_snoozed_until,
    },
    researcher: prof ?? null,
    referring_agent: referringAgent,
    lifetime: { spend: Math.round(lifetimeSpend * 100) / 100, orders: lifetimeOrders },
    recent_orders: orders ?? [],
    linked_order: linkedOrder,
    cart: cartRow ?? null,
  });
}
