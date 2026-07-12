import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getEffectiveUser } from '@/lib/impersonation';
import { assertSameOrigin } from '@/lib/csrf';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await getEffectiveUser(supabase);

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('researcher_inventory')
    .select('*')
    .eq('user_id', user.id);

  if (error) {
    console.error('Error fetching inventory:', error);
    return NextResponse.json({ error: 'Failed to fetch inventory' }, { status: 500 });
  }

  return NextResponse.json({ inventory: data });
}

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const supabase = await createClient();
  const { data: { user } } = await getEffectiveUser(supabase);

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { product_id, on_hand, lot_number, expiration_date, recon_mg, recon_ml, recon_dose } = await req.json();

    if (!product_id) {
      return NextResponse.json({ error: 'Missing product_id' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('researcher_inventory')
      .upsert({
        user_id: user.id,
        product_id,
        on_hand: Number(on_hand) || 0,
        lot_number: lot_number || null,
        expiration_date: expiration_date || null,
        recon_mg: recon_mg ? Number(recon_mg) : null,
        recon_ml: recon_ml ? Number(recon_ml) : null,
        recon_dose: recon_dose ? Number(recon_dose) : null,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id, product_id' })
      .select()
      .maybeSingle();

    if (error) throw error;

    return NextResponse.json({ item: data });
  } catch (error) {
    console.error('Error saving inventory:', error);
    return NextResponse.json({ error: 'Failed to save inventory' }, { status: 500 });
  }
}
