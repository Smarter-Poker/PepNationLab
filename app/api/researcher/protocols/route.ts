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
    .from('researcher_scheduled_protocols')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching protocols:', error);
    return NextResponse.json({ error: 'Failed to fetch protocols' }, { status: 500 });
  }

  return NextResponse.json({ protocols: data });
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
    const { compound_slug, amount, unit, frequency } = await req.json();

    if (!compound_slug || !amount || !unit || !frequency) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('researcher_scheduled_protocols')
      .insert({
        user_id: user.id,
        compound_slug,
        amount: Number(amount),
        unit,
        frequency,
        created_at: new Date().toISOString()
      })
      .select()
      .maybeSingle();

    if (error) throw error;

    return NextResponse.json({ protocol: data });
  } catch (error) {
    console.error('Error saving protocol:', error);
    return NextResponse.json({ error: 'Failed to save protocol' }, { status: 500 });
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
      return NextResponse.json({ error: 'Missing ID' }, { status: 400 });
    }

    const { error } = await supabase
      .from('researcher_scheduled_protocols')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting protocol:', error);
    return NextResponse.json({ error: 'Failed to delete protocol' }, { status: 500 });
  }
}
