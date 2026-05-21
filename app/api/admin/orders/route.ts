import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin-auth';
import { sendEmail, paymentReceivedEmail } from '@/lib/email';

// GET: List all orders with buyer profile join
export async function GET(req: NextRequest) {
  const gate = await requireAdmin();
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
  const gate = await requireAdmin();
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

  // When payment is confirmed (order approved), email the buyer.
  // Email failure must not break the status update.
  if (status === 'approved_ship' || status === 'approved_pickup') {
    try {
      const { data: orderRow } = await supabase
        .from('orders')
        .select('total, profiles!orders_buyer_id_fkey(email)')
        .eq('id', id)
        .single();

      const buyer = (orderRow?.profiles as unknown) as { email?: string } | null;
      if (buyer?.email) {
        const tpl = paymentReceivedEmail({
          orderId: id,
          total: Number(orderRow?.total ?? 0),
        });
        await sendEmail({ to: buyer.email, subject: tpl.subject, html: tpl.html });
      }
    } catch (emailError) {
      console.error('Payment Received Email Failed:', emailError);
    }
  }

  return NextResponse.json({ success: true });
}
