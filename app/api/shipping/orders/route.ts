import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { getEffectiveUser } from '@/lib/impersonation';
import { assertSameOrigin } from '@/lib/csrf';
import { canTransition, type OrderStatus } from '@/lib/order-states';
import { notifyOrderShipped } from '@/lib/notify';
import { shortOrderId } from '@/lib/push-enqueue';
import { emailConfigured, sendOrderShippedEmail } from '@/lib/email';
import { logOrderEvent } from '@/lib/order-events';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await getEffectiveUser(supabase);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    if (!profile || (profile.role !== 'shipping' && profile.role !== 'admin')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Use admin client to bypass RLS since we have manually verified the user's role
    const serviceClient = createAdminClient();

    // Fetch orders that need shipping + recently shipped
    const { data: orders, error } = await serviceClient
      .from('orders')
      .select(`
        id,
        buyer_id,
        agent_id,
        status,
        total,
        fulfillment_method,
        shipping_address,
        tracking_number,
        created_at,
        updated_at,
        buyer:profiles!orders_buyer_id_fkey(email, full_name, phone),
        agent:profiles!orders_agent_id_fkey(email, full_name),
        items:order_items(id, product_name, quantity, unit_retail_price)
      `)
      .in('status', ['approved_ship', 'in_fulfillment', 'shipped'])
      .eq('fulfillment_method', 'ship')
      .order('created_at', { ascending: true });

    if (error) {
      return NextResponse.json({ error: 'An Unexpected Error Occurred' }, { status: 500 });
    }

    return NextResponse.json({ data: orders });
  } catch (err) {
    console.error('[shipping/orders] GET error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const csrf = assertSameOrigin(request);
  if (csrf) return csrf;

  try {
    const supabase = await createClient();
    const { data: { user } } = await getEffectiveUser(supabase);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    if (!profile || (profile.role !== 'shipping' && profile.role !== 'admin')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    let body: { order_id?: string; tracking_number?: string; action?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
    }

    const { order_id, tracking_number, action } = body;

    if (!order_id || !action) {
      return NextResponse.json({ error: 'Missing Order_Id Or Action' }, { status: 400 });
    }

    let updateData: Record<string, string | null> = {};

    if (action === 'mark_shipped') {
      if (!tracking_number) {
        return NextResponse.json({ error: 'Tracking Number Is Required To Mark As Shipped' }, { status: 400 });
      }
      updateData = {
        status: 'shipped',
        tracking_number: tracking_number
      };
    } else if (action === 'save_tracking') {
      updateData = {
        tracking_number: tracking_number || null,
        status: 'in_fulfillment' // Move from approved_ship to in_fulfillment once tracking is assigned
      };
    } else {
      return NextResponse.json({ error: 'Invalid Action' }, { status: 400 });
    }

    // Use admin client to bypass RLS since we have manually verified the user's role
    const serviceClient = createAdminClient();

    // Gate the status change through the shared state machine. Without this, a
    // shipping-role account could set ANY order_id straight to 'shipped'/'in_fulfillment'
    // -- including orders still awaiting customer payment or admin approval -- because
    // the GET filter does not constrain POST inputs. canTransition('...','shipping')
    // permits only the post-admin-gate transitions.
    let prevStatus: OrderStatus | null = null;
    const nextStatus = updateData.status as OrderStatus | undefined;
    if (nextStatus) {
      const { data: current, error: currentErr } = await serviceClient
        .from('orders')
        .select('status')
        .eq('id', order_id)
        .maybeSingle();
      if (currentErr) {
        return NextResponse.json({ error: 'An Unexpected Error Occurred' }, { status: 500 });
      }
      if (!current) {
        return NextResponse.json({ error: 'Order Not Found' }, { status: 404 });
      }
      prevStatus = current.status as OrderStatus;
      if (!canTransition(current.status as OrderStatus, nextStatus, 'shipping')) {
        return NextResponse.json(
          { error: `Cannot Move Order From ${current.status} To ${nextStatus}.` },
          { status: 422 }
        );
      }
    }

    const { data, error } = await serviceClient
      .from('orders')
      .update(updateData)
      .eq('id', order_id)
      .select()
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: 'An Unexpected Error Occurred' }, { status: 500 });
    }

    // Audit log: the shipping team's status changes were previously untracked,
    // so admins had no record of who shipped what or when. Record it now.
    try {
      await serviceClient.from('admin_audit_log').insert({
        actor_id: user.id,
        action: 'order_shipping_updated',
        entity_type: 'order',
        entity_id: order_id,
        changes: {
          shipping_action: action,
          status: updateData.status ?? null,
          ...(tracking_number ? { tracking_number } : {}),
        },
      });
    } catch { /* audit failure must not break the shipping response */ }

    // Buyer notification + tracking email. This shipping-console path used to
    // flip the order silently -- the buyer got no in-app message, no push, and
    // no email at all. Mirror the admin mark-shipped path, gated on an actual
    // transition (prevStatus) so a re-save cannot double-notify.
    const buyerId = (data as { buyer_id?: string | null } | null)?.buyer_id ?? null;
    if (action === 'mark_shipped' && buyerId && prevStatus !== 'shipped') {
      try {
        const short = shortOrderId(order_id);
        await notifyOrderShipped(serviceClient, buyerId, order_id, short, tracking_number ?? undefined);
        await logOrderEvent(serviceClient, {
          orderId: order_id,
          event: 'shipped',
          actorId: user.id,
          actorRole: 'shipping',
          payload: { tracking_number: tracking_number ?? null, via: 'shipping_console' },
        });
        if (emailConfigured()) {
          const { data: buyer } = await serviceClient
            .from('profiles')
            .select('contact_email, email_verified, full_name')
            .eq('id', buyerId)
            .maybeSingle();
          if (buyer?.contact_email && buyer.email_verified) {
            await sendOrderShippedEmail({
              to: buyer.contact_email,
              fullName: buyer.full_name,
              orderId: order_id,
              trackingNumber: tracking_number ?? null,
            });
          }
        }
      } catch { /* notifications must not break the shipping response */ }
    }

    // Timeline event when this console moves an order from approved_ship to
    // in_fulfillment (tracking assigned, not yet physically shipped).
    if (action === 'save_tracking' && prevStatus && prevStatus !== updateData.status) {
      try {
        await logOrderEvent(serviceClient, {
          orderId: order_id,
          event: 'status_changed',
          actorId: user.id,
          actorRole: 'shipping',
          payload: { from: prevStatus, to: updateData.status },
        });
      } catch { /* timeline must not break the shipping response */ }
    }

    return NextResponse.json({ data, message: 'Order Updated Successfully' });
  } catch (err) {
    console.error('[shipping/orders] POST error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
