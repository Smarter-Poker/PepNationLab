import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/messenger/support/[id]/context
 * Admin-only. Returns a right-rail context bundle for the support thread:
 * researcher profile, lifetime spend, recent orders (last 5), current cart
 * snapshot, referring agent (including storefront slug), and linked order.
 *
 * Lifetime spend EXCLUDES cancelled + pending_customer_payment orders so the
 * number reflects committed revenue rather than vapor.
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
    .select('id, is_support, support_order_id, support_topic, support_status, support_first_response_at, support_last_researcher_message_at, support_snoozed_until')
    .eq('id', id)
    .eq('is_support', true)
    .maybeSingle();
  if (!conv) return NextResponse.json({ error: 'Conversation Not Found' }, { status: 404 });

  const { data: parts } = await svc
    .from('messenger_participants')
    .select('user_id')
    .eq('conversation_id', id);
  const researcherId = (parts ?? []).map((p) => p.user_id as string).find((u) => u !== user.id);
  if (!researcherId) return NextResponse.json({ error: 'Researcher Not Found' }, { status: 404 });

  // NOTE: `is_super_agent` is included so the sidebar can render the
  // effective role label correctly. Super agents in this codebase have
  // role='agent' (or sometimes 'super_agent') AND is_super_agent=true; the
  // boolean flag is the source of truth. The sidebar derives "Super Agent"
  // from this flag rather than relying on the enum.
  const { data: prof } = await svc
    .from('profiles')
    .select('id, email, full_name, username, role, is_super_agent, is_sub_agent, created_at, referring_agent_id, parent_agent_id, last_sign_in_at, tier, account_type')
    .eq('id', researcherId)
    .maybeSingle();

  const { data: orders } = await svc
    .from('orders')
    .select('id, status, total, subtotal, fulfillment_method, payment_method, coupon_code, tracking_number, created_at')
    .eq('buyer_id', researcherId)
    .order('created_at', { ascending: false })
    .limit(5);

  // Lifetime spend = sum of total for orders that actually committed revenue.
  // Excludes cancelled AND pending_customer_payment so we don't inflate LTV
  // with vapor.
  const { data: ltvRows } = await svc
    .from('orders')
    .select('total, status')
    .eq('buyer_id', researcherId);
  let lifetimeSpend = 0; let lifetimeOrders = 0;
  for (const o of (ltvRows ?? []) as Array<{ total: number | null; status: string | null }>) {
    if (o.status === 'cancelled' || o.status === 'pending_customer_payment') continue;
    lifetimeSpend += Number(o.total) || 0;
    lifetimeOrders += 1;
  }
  lifetimeSpend = Math.round(lifetimeSpend * 100) / 100;

  // Cart snapshot - derive item_count + subtotal from the JSONB cart_state.
  const { data: cartRow } = await svc
    .from('profiles')
    .select('cart_state, cart_updated_at')
    .eq('id', researcherId)
    .maybeSingle();
  let cartItemCount = 0;
  let cartSubtotal = 0;
  const cartItems = Array.isArray(cartRow?.cart_state) ? cartRow.cart_state as Array<Record<string, unknown>> : [];
  for (const it of cartItems) {
    const qty = Number((it as { quantity?: unknown }).quantity) || 0;
    const cost = Number(
      (it as { costPrice?: unknown }).costPrice
        ?? (it as { cost_price?: unknown }).cost_price
        ?? (it as { retailPrice?: unknown }).retailPrice
        ?? (it as { retail_price?: unknown }).retail_price
        ?? 0,
    ) || 0;
    cartItemCount += qty;
    cartSubtotal += cost * qty;
  }
  cartSubtotal = Math.round(cartSubtotal * 100) / 100;

  // Referring agent - include storefront slug from agent_profiles.
  let referringAgent: { id: string; full_name: string | null; username: string | null; slug: string | null } | null = null;
  if (prof?.referring_agent_id) {
    const { data: ag } = await svc
      .from('profiles')
      .select('id, full_name, username')
      .eq('id', prof.referring_agent_id)
      .maybeSingle();
    const { data: agStore } = await svc
      .from('agent_profiles')
      .select('slug')
      .eq('id', prof.referring_agent_id)
      .maybeSingle();
    if (ag) {
      referringAgent = {
        id: ag.id,
        full_name: ag.full_name,
        username: ag.username,
        slug: agStore?.slug ?? null,
      };
    }
  }

  let linkedOrder: {
    id: string;
    status: string;
    total: number;
    created_at: string;
    tracking_number: string | null;
    tracking_url: string | null;
  } | null = null;
  if (conv.support_order_id) {
    const { data: lo } = await svc
      .from('orders')
      .select('id, status, total, created_at, tracking_number, label_url')
      .eq('id', conv.support_order_id)
      .maybeSingle();
    if (lo) {
      const tn = (lo as { tracking_number?: string | null }).tracking_number ?? null;
      // Tracking URL: prefer the explicit carrier label_url when present (it
      // doubles as a tracking link in this codebase), else null.
      const labelUrl = (lo as { label_url?: string | null }).label_url ?? null;
      linkedOrder = {
        id: lo.id,
        status: lo.status,
        total: Number(lo.total) || 0,
        created_at: lo.created_at,
        tracking_number: tn,
        tracking_url: tn && labelUrl ? labelUrl : null,
      };
    }
  }

  return NextResponse.json(
    {
      conversation: {
        id: conv.id,
        is_support: conv.is_support === true,
        support_topic: conv.support_topic,
        support_status: conv.support_status,
        support_order_id: conv.support_order_id,
        support_first_response_at: conv.support_first_response_at,
        support_last_researcher_message_at: conv.support_last_researcher_message_at,
        support_snoozed_until: conv.support_snoozed_until,
      },
      researcher: prof ?? null,
      referring_agent: referringAgent,
      // Lifetime ships BOTH the legacy and the sidebar's expected field names
      // so any older consumer doesn't break and the sidebar reads correctly.
      lifetime: {
        spend: lifetimeSpend,
        orders: lifetimeOrders,
        total_spent: lifetimeSpend,
        order_count: lifetimeOrders,
      },
      recent_orders: orders ?? [],
      linked_order: linkedOrder,
      cart: {
        cart_state: cartRow?.cart_state ?? null,
        cart_updated_at: cartRow?.cart_updated_at ?? null,
        item_count: cartItemCount,
        subtotal: cartSubtotal,
      },
    },
    {
      headers: {
        'Cache-Control': 'private, no-store, max-age=0',
      },
    },
  );
}
