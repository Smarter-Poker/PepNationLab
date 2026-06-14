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
    .from('researcher_biometrics')
    .select('*')
    .eq('user_id', session.user.id)
    .order('measured_at', { ascending: true });

  if (error) {
    console.error('Error fetching biometrics:', error);
    return NextResponse.json({ error: 'Failed to fetch biometrics' }, { status: 500 });
  }

  return NextResponse.json({ biometrics: data });
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
    const { metric_name, metric_value, unit, measured_at, notes } = await req.json();

    if (!metric_name || metric_value === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('researcher_biometrics')
      .insert({
        user_id: session.user.id,
        metric_name,
        metric_value: Number(metric_value),
        unit,
        measured_at: measured_at || new Date().toISOString(),
        notes
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ biometric: data });
  } catch (error) {
    console.error('Error logging biometric:', error);
    return NextResponse.json({ error: 'Failed to log biometric' }, { status: 500 });
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
      .from('researcher_biometrics')
      .delete()
      .eq('id', id)
      .eq('user_id', session.user.id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting biometric:', error);
    return NextResponse.json({ error: 'Failed to delete biometric' }, { status: 500 });
  }
}
