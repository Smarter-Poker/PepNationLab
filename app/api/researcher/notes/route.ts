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

  const { searchParams } = new URL(req.url);
  const compoundSlug = searchParams.get('compound_slug');

  let query = supabase
    .from('researcher_notes')
    .select('*')
    .eq('user_id', user!.id)
    .order('updated_at', { ascending: false });

  if (compoundSlug) {
    query = query.eq('compound_slug', compoundSlug);
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching notes:', error);
    return NextResponse.json({ error: 'Failed to fetch notes' }, { status: 500 });
  }

  return NextResponse.json({ notes: data });
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
    const { compound_slug, title, note_text } = await req.json();

    if (!note_text || typeof note_text !== 'string') {
      return NextResponse.json({ error: 'Note text is required' }, { status: 400 });
    }
    if (note_text.length > 50_000) {
      return NextResponse.json({ error: 'Note text exceeds maximum length (50,000 chars)' }, { status: 400 });
    }
    if (title && (typeof title !== 'string' || title.length > 255)) {
      return NextResponse.json({ error: 'Title too long' }, { status: 400 });
    }
    if (compound_slug && (typeof compound_slug !== 'string' || compound_slug.length > 100)) {
      return NextResponse.json({ error: 'compound_slug too long' }, { status: 400 });
    }

    const { count } = await supabase
      .from('researcher_notes')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user!.id);

    if ((count ?? 0) >= 500) {
      return NextResponse.json({ error: 'Notes limit reached (500)' }, { status: 429 });
    }

    const { data, error } = await supabase
      .from('researcher_notes')
      .insert({
        user_id: user!.id,
        compound_slug,
        title,
        note_text
      })
      .select()
      .maybeSingle();

    if (error) throw error;

    return NextResponse.json({ note: data });
  } catch (error) {
    console.error('Error creating note:', error);
    return NextResponse.json({ error: 'Failed to create note' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id, title, note_text } = await req.json();

    if (!id || !note_text || typeof note_text !== 'string') {
      return NextResponse.json({ error: 'ID and Note text are required' }, { status: 400 });
    }
    if (note_text.length > 50_000) {
      return NextResponse.json({ error: 'Note text exceeds maximum length (50,000 chars)' }, { status: 400 });
    }
    if (title && (typeof title !== 'string' || title.length > 255)) {
      return NextResponse.json({ error: 'Title too long' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('researcher_notes')
      .update({ title, note_text, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', user!.id)
      .select()
      .maybeSingle();

    if (error) throw error;

    return NextResponse.json({ note: data });
  } catch (error) {
    console.error('Error updating note:', error);
    return NextResponse.json({ error: 'Failed to update note' }, { status: 500 });
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
      .from('researcher_notes')
      .delete()
      .eq('id', id)
      .eq('user_id', user!.id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting note:', error);
    return NextResponse.json({ error: 'Failed to delete note' }, { status: 500 });
  }
}
