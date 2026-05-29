import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireOrdersAccess } from '@/lib/admin-auth';
import { canTransition, type OrderStatus } from '@/lib/order-states';
import { enqueueOrderSms, shortOrderId, type OrderSmsEvent } from '@/lib/sms-enqueue';
import { enqueueOrderPush } from '@/lib/push-enqueue';

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

  if (!canTransition(currentStatus, nextStatus, gate.role)) {
    return NextResponse.json(
      { error: `Invalid Status Transition From ${currentStatus} To ${nextStatus}` },
      { status: 422 }
    );
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

  // SMS notification (fire-and-forget — must never break the admin write).
  try {
    const { data: orderRow } = await supabase
      .from('orders')
      .select('buyer_id, tracking_number')
      .eq('id', id)
      .maybeSingle();

    if (orderRow?.buyer_id) {
      const short = shortOrderId(id);
      let event: OrderSmsEvent | null = null;
      let body = '';
      if (status === 'approved_ship' || status === 'approved_pickup') {
        event = 'order_approved';
        body = `Your Order #${short} Has Been Approved. Get Ready For Shipping.`;
      } else if (status === 'shipped') {
        event = 'order_shipped';
        const trk = orderRow.tracking_number || tracking_number;
        body = trk
          ? `Your Order #${short} Shipped. Tracking: ${trk}`
          : `Your Order #${short} Shipped.`;
      } else if (status === 'delivered') {
        event = 'order_delivered';
        body = `Your Order #${short} Has Been Delivered. Thank You.`;
      }

      if (event && body) {
        await enqueueOrderSms(supabase, {
          userId: orderRow.buyer_id,
          orderId: id,
          event,
          body,
        });
        try {
          const trk = orderRow.tracking_number || tracking_number || null;
          await enqueueOrderPush(supabase, {
            userId: orderRow.buyer_id,
            orderId: id,
            event,
            tracking: trk,
          });
        } catch { /* push failures must not break admin response */ }
      }
    }
  } catch { /* never block admin response on SMS failure */ }

  return NextResponse.json({ success: true });
}
