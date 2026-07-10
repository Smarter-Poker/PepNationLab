import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';
import { rateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

/**
 * Read the signed-in researcher's saved cart.
 *
 * cart_state was write-only: the client POSTed it on every change and the
 * reminder crons read it, but nothing ever handed it back. That made the
 * abandoned-cart recovery email a dead end -- open it on another device and you
 * land on an empty cart. This is the missing read side.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      // Guests have nothing to restore; not an error condition.
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const limited = await rateLimit({
      key: 'cart_restore',
      limit: 60,
      windowSeconds: 60,
      identifier: user.id,
    });
    if (!limited.allowed) {
      return NextResponse.json({ error: 'Rate Limit Exceeded' }, { status: 429 });
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('cart_state, cart_updated_at')
      .eq('id', user.id)
      .maybeSingle();

    if (error) {
      console.error('Cart Restore Error:', error);
      return NextResponse.json({ error: 'Failed To Load Cart' }, { status: 500 });
    }

    const raw = data?.cart_state;
    let cart: unknown = [];
    if (Array.isArray(raw)) {
      cart = raw;
    } else if (typeof raw === 'string') {
      try { cart = JSON.parse(raw); } catch { cart = []; }
    }
    if (!Array.isArray(cart)) cart = [];

    return NextResponse.json({ cart, cart_updated_at: data?.cart_updated_at ?? null });
  } catch {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

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

    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    const { cart } = body;

    if (!Array.isArray(cart)) {
      return NextResponse.json({ error: 'Invalid Cart Format' }, { status: 400 });
    }

    if (cart.length > 50) {
      return NextResponse.json({ error: 'Cart Exceeds Maximum Item Limit (50).' }, { status: 400 });
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    const strippedCart = cart
      .filter((item: any) => typeof item.id === 'string' && uuidRegex.test(item.id))
      .map((item: any) => ({
        id: item.id,
        name: String(item.name || '').slice(0, 100),
        sku: item.sku ? String(item.sku).slice(0, 50) : null,
        quantity: Math.max(1, Math.min(9999, Math.floor(Number(item.quantity) || 1))),
        costPrice: Math.max(0, Number(item.costPrice) || 0),
        retailPrice: Math.max(0, Number(item.retailPrice) || 0),
        bulkCostPrice: item.bulkCostPrice != null ? Math.max(0, Number(item.bulkCostPrice)) : null,
        bulkThreshold: item.bulkThreshold != null ? Math.max(1, Math.floor(Number(item.bulkThreshold))) : null,
        weightOz: item.weightOz != null ? Math.max(0, Number(item.weightOz)) : null,
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
