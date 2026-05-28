import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { cart } = body;

    if (!Array.isArray(cart)) {
      return NextResponse.json({ error: 'Invalid cart format' }, { status: 400 });
    }

    // Persist the fields the cart needs to re-hydrate accurately. weightOz
    // and sku are essential for shipping calc and storefront display, so they
    // must round-trip with the cart state.
    const strippedCart = cart.map((item: any) => ({
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
      return NextResponse.json({ error: 'Failed to sync cart' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
