import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getEffectiveUser } from '@/lib/impersonation';
import { assertSameOrigin } from '@/lib/csrf';
import { safeError } from '@/lib/api-error';

// Full platform method list. Must stay in step with the payment_method DB
// enum, PAYMENT_METHOD_ENUM in /api/account/payment-method, and the orders
// route schema (all 10 methods, including Varo).
const VALID_PAYMENT_METHODS = ['zelle', 'cashapp', 'venmo', 'apple_pay', 'apple_cash', 'paypal', 'google_wallet', 'wise', 'chime', 'varo'] as const;

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  try {
    const supabase = await createClient();
    const { data: { user } } = await getEffectiveUser(supabase);

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { orderId, paymentMethod } = body;

    if (!orderId || !paymentMethod) {
      return NextResponse.json({ error: 'Missing Parameters' }, { status: 400 });
    }

    if (!VALID_PAYMENT_METHODS.includes(paymentMethod)) {
      return NextResponse.json(
        { error: `Invalid Payment Method. Allowed: ${VALID_PAYMENT_METHODS.join(', ')}` },
        { status: 400 }
      );
    }

    // Verify ownership and status
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('buyer_id, status')
      .eq('id', orderId)
      .maybeSingle();

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
