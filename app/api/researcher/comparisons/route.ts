import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('researcher_comparisons')
    .select('*')
    .eq('user_id', session.user.id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching comparisons:', error);
    return NextResponse.json({ error: 'Failed to fetch comparisons' }, { status: 500 });
  }

  return NextResponse.json({ comparisons: data });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { product_ids } = await req.json();

    if (!product_ids || !Array.isArray(product_ids) || product_ids.length === 0) {
      return NextResponse.json({ error: 'Product IDs are required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('researcher_comparisons')
      .insert({
        user_id: session.user.id,
        product_ids
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ comparison: data });
  } catch (error) {
    console.error('Error saving comparison:', error);
    return NextResponse.json({ error: 'Failed to save comparison' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
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
      .from('researcher_comparisons')
      .delete()
      .eq('id', id)
      .eq('user_id', session.user.id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting comparison:', error);
    return NextResponse.json({ error: 'Failed to delete comparison' }, { status: 500 });
  }
}
