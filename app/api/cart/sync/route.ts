import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getEffectiveUser } from '@/lib/impersonation';
import { assertSameOrigin } from '@/lib/csrf';
import { rateLimit } from '@/lib/rate-limit';
import { sanitizeStoredCart } from '@/lib/schemas/cart';

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
    const { data: { user }, error: authError } = await getEffectiveUser(supabase);
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
    let parsedRaw: unknown = raw;
    if (typeof raw === 'string') {
      try { parsedRaw = JSON.parse(raw); } catch { parsedRaw = []; }
    }
    // Sanitize on the READ side too: cart_state is a JSONB round-trip of
    // client-authored data, so a row written before validation existed (or
    // tampered with directly) must still come back shape-safe.
    const cart = sanitizeStoredCart(parsedRaw);

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
    const { data: { user }, error: authError } = await getEffectiveUser(supabase);

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

    // Shared fail-closed sanitizer (lib/schemas/cart.ts). Identical rules on
    // the write side (here) and the read side (GET above + the client's
    // restore path), so the round-trip cannot drift. bundleName drives stack
    // grouping + the 10% stack discount; agentSelfBuy gates bulk pricing and
    // min-qty rules at checkout -- both survive the round-trip; NaN or
    // malformed prices never do.
    const strippedCart = sanitizeStoredCart(cart);

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
