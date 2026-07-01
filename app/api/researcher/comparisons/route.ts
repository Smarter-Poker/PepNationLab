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
    .from('researcher_comparisons')
    .select('*')
    .eq('user_id', user!.id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching comparisons:', error);
    return NextResponse.json({ error: 'Failed to fetch comparisons' }, { status: 500 });
  }

  return NextResponse.json({ comparisons: data });
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
    const { product_ids, folder_name, notes } = await req.json();

    if (!product_ids || !Array.isArray(product_ids) || product_ids.length === 0) {
      return NextResponse.json({ error: 'Product IDs are required' }, { status: 400 });
    }
    if (product_ids.length > 20) {
      return NextResponse.json({ error: 'Cannot compare more than 20 products at once' }, { status: 400 });
    }
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!product_ids.every((id: unknown) => typeof id === 'string' && UUID_RE.test(id))) {
      return NextResponse.json({ error: 'Invalid product_ids format' }, { status: 400 });
    }
    if (folder_name && (typeof folder_name !== 'string' || folder_name.length > 100)) {
      return NextResponse.json({ error: 'folder_name too long' }, { status: 400 });
    }
    if (notes && (typeof notes !== 'string' || notes.length > 2000)) {
      return NextResponse.json({ error: 'notes too long' }, { status: 400 });
    }

    const { count } = await supabase
      .from('researcher_comparisons')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user!.id);
      
    if ((count ?? 0) >= 100) {
      return NextResponse.json({ error: 'Comparisons limit reached (100)' }, { status: 429 });
    }

    const { data, error } = await supabase
      .from('researcher_comparisons')
      .insert({
        user_id: user!.id,
        product_ids,
        folder_name,
        notes
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
      .from('researcher_comparisons')
      .delete()
      .eq('id', id)
      .eq('user_id', user!.id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting comparison:', error);
    return NextResponse.json({ error: 'Failed to delete comparison' }, { status: 500 });
  }
}
