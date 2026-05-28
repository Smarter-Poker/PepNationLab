import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireOrdersAccess } from '@/lib/admin-auth';

/**
 * Order status state machine (forward-only).
 * Keys = current status; values = the statuses a transition can legally
 * move them to. Admins additionally may move any non-terminal status to
 * 'cancelled' (handled below). Shipping is further restricted to the three
 * fulfillment edges.
 */
type OrderStatus =
  | 'pending_customer_payment'
  | 'agent_approval_pending'
  | 'approved_ship'
  | 'approved_pickup'
  | 'in_fulfillment'
  | 'shipped'
  | 'delivered'
  | 'cancelled';

const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending_customer_payment: ['agent_approval_pending', 'approved_ship', 'approved_pickup', 'in_fulfillment', 'cancelled'],
  agent_approval_pending: ['approved_ship', 'approved_pickup', 'in_fulfillment', 'cancelled'],
  approved_ship: ['in_fulfillment', 'shipped', 'cancelled'],
  approved_pickup: ['in_fulfillment', 'delivered', 'cancelled'],
  in_fulfillment: ['shipped', 'delivered', 'cancelled'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: [],
};

const SHIPPING_TRANSITIONS: Partial<Record<OrderStatus, OrderStatus[]>> = {
  pending_customer_payment: ['in_fulfillment'],
  approved_ship: ['in_fulfillment'],
  in_fulfillment: ['shipped'],
  shipped: ['delivered'],
};

// GET: List all orders with buyer profile join
export async function GET(req: NextRequest) {
  const gate = await requireOrdersAccess();
  if (!gate.ok) return gate.response;

  const supabase = await createServiceClient();
  const searchParams = req.nextUrl.searchParams;
  const status = searchParams.get('status');
  const query = searchParams.get('query');

  let dbQuery = supabase
    .from('orders')
    .select('*, profiles!orders_buyer_id_fkey(full_name, email, phone)');

  if (status) {
    dbQuery = dbQuery.eq('status', status);
  }

  // Sort by created_at desc
  dbQuery = dbQuery.order('created_at', { ascending: false });

  const { data, error } = await dbQuery;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Filter in memory for fuzzy text search across joined profile fields
  let filteredData = data || [];
  if (query) {
    const q = query.toLowerCase();
    filteredData = filteredData.filter((order: any) => {
      const buyer = order.profiles;
      return (
        order.id.toLowerCase().includes(q) ||
        (buyer?.full_name || '').toLowerCase().includes(q) ||
        (buyer?.email || '').toLowerCase().includes(q) ||
        (buyer?.phone || '').toLowerCase().includes(q)
      );
    });
  }

  return NextResponse.json({ data: filteredData });
}

// POST: Process / Update an order state
export async function POST(req: NextRequest) {
  const gate = await requireOrdersAccess();
  if (!gate.ok) return gate.response;

  const supabase = await createServiceClient();
  const body = await req.json().catch(() => ({}));

  const {
    id,
    status,
    tracking_number,
    agent_approval_notes,
  } = body;

  if (!id || !status) {
    return NextResponse.json({ error: 'Missing Order ID Or New Status' }, { status: 400 });
  }

  // Fetch the current status so we can validate the transition.
  const { data: existingOrder, error: fetchErr } = await supabase
    .from('orders')
    .select('status')
    .eq('id', id)
    .single();

  if (fetchErr || !existingOrder) {
    return NextResponse.json({ error: 'Order Not Found' }, { status: 404 });
  }

  const currentStatus = existingOrder.status as OrderStatus;
  const nextStatus = status as OrderStatus;

  // Terminal states cannot leave.
  if (currentStatus === 'cancelled' || currentStatus === 'delivered') {
    if (currentStatus !== nextStatus) {
      return NextResponse.json(
        { error: `Invalid Status Transition From ${currentStatus} To ${nextStatus}` },
        { status: 422 }
      );
    }
  }

  // Idempotent no-op transitions allowed (e.g. saving a tracking number
  // without flipping status).
  if (currentStatus !== nextStatus) {
    if (gate.role === 'shipping') {
      // Shipping role restricted to the three fulfillment edges.
      const allowed = SHIPPING_TRANSITIONS[currentStatus] ?? [];
      if (!allowed.includes(nextStatus)) {
        return NextResponse.json(
          { error: `Invalid Status Transition From ${currentStatus} To ${nextStatus}` },
          { status: 422 }
        );
      }
    } else {
      // Admin: forward-only via the ALLOWED_TRANSITIONS table.
      const allowed = ALLOWED_TRANSITIONS[currentStatus] ?? [];
      if (!allowed.includes(nextStatus)) {
        return NextResponse.json(
          { error: `Invalid Status Transition From ${currentStatus} To ${nextStatus}` },
          { status: 422 }
        );
      }
    }
  }

  const updates: any = {
    status,
    updated_at: new Date().toISOString(),
  };

  if (tracking_number !== undefined) {
    updates.tracking_number = tracking_number || null;
  }

  if (agent_approval_notes !== undefined) {
    updates.agent_approval_notes = agent_approval_notes || null;
  }

  // If approved, set approval timestamp
  if (status === 'approved_ship' || status === 'approved_pickup') {
    updates.agent_approved_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from('orders')
    .update(updates)
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
