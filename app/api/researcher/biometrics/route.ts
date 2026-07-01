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
    .from('researcher_biometrics')
    .select('*')
    .eq('user_id', user!.id)
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
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { metric_name, metric_value, unit, measured_at, notes } = await req.json();

    if (!metric_name || metric_value === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (typeof metric_name !== 'string' || metric_name.length > 100) {
      return NextResponse.json({ error: 'metric_name too long' }, { status: 400 });
    }
    if (unit && (typeof unit !== 'string' || unit.length > 50)) {
      return NextResponse.json({ error: 'unit too long' }, { status: 400 });
    }
    if (notes && (typeof notes !== 'string' || notes.length > 2000)) {
      return NextResponse.json({ error: 'notes too long' }, { status: 400 });
    }

    const numericValue = Number(metric_value);
    if (!Number.isFinite(numericValue) || numericValue < -1e9 || numericValue > 1e9) {
      return NextResponse.json({ error: 'metric_value must be a finite number within safe range' }, { status: 400 });
    }

    const parsedDate = measured_at ? new Date(measured_at) : new Date();
    if (isNaN(parsedDate.getTime())) {
      return NextResponse.json({ error: 'Invalid measured_at date' }, { status: 400 });
    }

    const { count } = await supabase
      .from('researcher_biometrics')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user!.id);

    if ((count ?? 0) >= 1000) {
      return NextResponse.json({ error: 'Biometric record limit reached (1000)' }, { status: 429 });
    }

    const { data, error } = await supabase
      .from('researcher_biometrics')
      .insert({
        user_id: user!.id,
        metric_name,
        metric_value: numericValue,
        unit,
        measured_at: parsedDate.toISOString(),
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
      .from('researcher_biometrics')
      .delete()
      .eq('id', id)
      .eq('user_id', user!.id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting biometric:', error);
    return NextResponse.json({ error: 'Failed to delete biometric' }, { status: 500 });
  }
}
