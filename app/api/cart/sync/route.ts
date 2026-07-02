import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';
import { rateLimit } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // fix-47: rate-limit. 120/min/user is generous enough that a real cart
    // session (sub-second debounced writes during checkout) never trips it,
    // but caps a misbehaving tab that would otherwise hammer profiles UPDATE.
    const limited = await rateLimit({
      key: 'cart_sync',
      limit: 120,
      windowSeconds: 60,
      identifier: user.id,
    });
    if (!limited.allowed) {
      return NextResponse.json({ error: 'Rate Limit Exceeded' }, { status: 429 });
    }

    const body = await req.json();
    const { cart } = body;

    if (!Array.isArray(cart)) {
      return NextResponse.json({ error: 'Invalid Cart Format' }, { status: 400 });
    }

    if (cart.length > 50) {
      return NextResponse.json({ error: 'Cart Exceeds Maximum Item Limit (50).' }, { status: 400 });
    }

    const strippedCart = cart.map((item: Record<string, unknown>) => ({
      id: item.id,
      name: item.name,
      sku: item.sku ?? null,
      quantity: item.quantity,
      costPrice: item.costPrice,
      retailPrice: item.retailPrice,
      bulkCostPrice: item.bulkCostPrice,
      bulkThreshold: item.bulkThreshold,
      weightOz: item.weightOz ?? null,
    }));

    const { error } = await supabase
      .from('profiles')
      .update({
        cart_state: strippedCart,
        cart_updated_at: new Date().toISOString()
      })
      .eq('id', user.id);

    if (error) {
      console.error('Cart Sync Error:', error);
      return NextResponse.json({ error: 'Failed To Sync Cart' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
