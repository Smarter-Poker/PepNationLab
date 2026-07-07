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
    .from('researcher_goals')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching goals:', error);
    return NextResponse.json({ error: 'Failed to fetch goals' }, { status: 500 });
  }

  return NextResponse.json({ goals: data });
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
    const { goal_name, is_active } = await req.json();

    if (!goal_name) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (is_active) {
      // Deactivate all other goals first if making this one active
      await supabase
        .from('researcher_goals')
        .update({ is_active: false })
        .eq('user_id', user.id);
    }

    const { data, error } = await supabase
      .from('researcher_goals')
      .insert({
        user_id: user.id,
        goal_name,
        is_active: is_active || false,
        created_at: new Date().toISOString()
      })
      .select()
      .maybeSingle();

    if (error) throw error;

    return NextResponse.json({ goal: data });
  } catch (error) {
    console.error('Error saving goal:', error);
    return NextResponse.json({ error: 'Failed to save goal' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id, is_active } = await req.json();

    if (!id) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (is_active) {
      // Deactivate all other goals
      await supabase
        .from('researcher_goals')
        .update({ is_active: false })
        .eq('user_id', user.id);
    }

    const { data, error } = await supabase
      .from('researcher_goals')
      .update({ is_active, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .maybeSingle();

    if (error) throw error;

    return NextResponse.json({ goal: data });
  } catch (error) {
    console.error('Error updating goal:', error);
    return NextResponse.json({ error: 'Failed to update goal' }, { status: 500 });
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
      .from('researcher_goals')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting goal:', error);
    return NextResponse.json({ error: 'Failed to delete goal' }, { status: 500 });
  }
}
