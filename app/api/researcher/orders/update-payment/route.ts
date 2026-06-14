import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';
import { safeError } from '@/lib/api-error';

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { orderId, paymentMethod } = body;

    if (!orderId || !paymentMethod) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    // Verify ownership and status
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('buyer_id, status')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    if (order.buyer_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (order.status !== 'pending_customer_payment') {
      return NextResponse.json({ error: 'Cannot change payment method at this stage' }, { status: 400 });
    }

    const { error: updateError } = await supabase
      .from('orders')
      .update({ payment_method: paymentMethod })
      .eq('id', orderId);

    if (updateError) throw updateError;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Update Payment Method Error:', error);
    return safeError('researcher.update_payment', error);
  }
}
