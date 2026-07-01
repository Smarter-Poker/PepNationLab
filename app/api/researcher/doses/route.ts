import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('researcher_doses')
    .select('*')
    .eq('user_id', user!.id)
    .order('dosed_at', { ascending: false });

  if (error) {
    console.error('Error fetching doses:', error);
    return NextResponse.json({ error: 'Failed to fetch doses' }, { status: 500 });
  }

  return NextResponse.json({ doses: data });
}

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { compound_slug, dose_amount, unit, dosed_at, notes } = await req.json();

    if (!compound_slug || !dose_amount || !unit) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (typeof compound_slug !== 'string' || compound_slug.length > 100) {
      return NextResponse.json({ error: 'compound_slug too long' }, { status: 400 });
    }
    if (typeof unit !== 'string' || unit.length > 20) {
      return NextResponse.json({ error: 'unit too long' }, { status: 400 });
    }
    if (notes && (typeof notes !== 'string' || notes.length > 2000)) {
      return NextResponse.json({ error: 'notes too long' }, { status: 400 });
    }

    const numericDose = Number(dose_amount);
    if (!Number.isFinite(numericDose) || numericDose <= 0 || numericDose > 100_000) {
      return NextResponse.json({ error: 'dose_amount must be a positive finite number under 100,000' }, { status: 400 });
    }

    const parsedDate = dosed_at ? new Date(dosed_at) : new Date();
    if (isNaN(parsedDate.getTime())) {
      return NextResponse.json({ error: 'Invalid dosed_at date' }, { status: 400 });
    }

    const { count } = await supabase
      .from('researcher_doses')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user!.id);

    if ((count ?? 0) >= 5000) {
      return NextResponse.json({ error: 'Dose log limit reached (5000)' }, { status: 429 });
    }

    const { data, error } = await supabase
      .from('researcher_doses')
      .insert({
        user_id: user!.id,
        compound_slug,
        dose_amount: numericDose,
        unit,
        dosed_at: parsedDate.toISOString(),
        notes
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ dose: data });
  } catch (error) {
    console.error('Error logging dose:', error);
    return NextResponse.json({ error: 'Failed to log dose' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await req.json();

    if (!id) {
      return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('researcher_doses')
      .delete()
      .eq('id', id)
      .eq('user_id', user!.id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting dose:', error);
    return NextResponse.json({ error: 'Failed to delete dose' }, { status: 500 });
  }
}
