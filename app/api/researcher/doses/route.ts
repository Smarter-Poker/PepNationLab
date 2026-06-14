import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('researcher_doses')
    .select('*')
    .eq('user_id', session.user.id)
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
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { compound_slug, dose_amount, unit, dosed_at, notes } = await req.json();

    if (!compound_slug || !dose_amount || !unit) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('researcher_doses')
      .insert({
        user_id: session.user.id,
        compound_slug,
        dose_amount,
        unit,
        dosed_at: dosed_at || new Date().toISOString(),
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
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
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
      .eq('user_id', session.user.id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting dose:', error);
    return NextResponse.json({ error: 'Failed to delete dose' }, { status: 500 });
  }
}
