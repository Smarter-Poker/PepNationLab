import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';
import { rateLimit, getClientIp } from '@/lib/rate-limit';

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

  const rl = await rateLimit({ key: 'researcher_biometric', limit: 60, windowSeconds: 60, identifier: user.id || getClientIp(req) });
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too Many Requests' }, { status: 429 });
  }

  try {
    const body = await req.json();

    const insertRecord = async (record: any) => {
      const { metric_name, metric_value, unit, measured_at, notes } = record;

      if (!metric_name || metric_value === undefined) {
        throw new Error('Missing required fields');
      }
      if (typeof metric_name !== 'string' || metric_name.length > 100) {
        throw new Error('metric_name too long');
      }
      if (unit && (typeof unit !== 'string' || unit.length > 50)) {
        throw new Error('unit too long');
      }
      if (notes && (typeof notes !== 'string' || notes.length > 2000)) {
        throw new Error('notes too long');
      }

      const numericValue = Number(metric_value);
      if (!Number.isFinite(numericValue) || numericValue < -1e9 || numericValue > 1e9) {
        throw new Error('metric_value must be a finite number within safe range');
      }

      const parsedDate = measured_at ? new Date(measured_at) : new Date();
      if (isNaN(parsedDate.getTime())) {
        throw new Error('Invalid measured_at date');
      }

      return {
        user_id: user!.id,
        metric_name,
        metric_value: numericValue,
        unit,
        measured_at: parsedDate.toISOString(),
        notes
      };
    };

    const { count } = await supabase
      .from('researcher_biometrics')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user!.id);

    if ((count ?? 0) >= 1000) {
      return NextResponse.json({ error: 'Biometric record limit reached (1000)' }, { status: 429 });
    }

    if (Array.isArray(body)) {
      if (body.length > 100) return NextResponse.json({ error: 'Max 100 records per bulk insert' }, { status: 400 });
      if ((count ?? 0) + body.length > 1000) return NextResponse.json({ error: 'Limit reached' }, { status: 429 });
      
      const records = [];
      for (const b of body) records.push(await insertRecord(b));
      
      const { data, error } = await supabase
        .from('researcher_biometrics')
        .insert(records)
        .select();
      
      if (error) throw error;
      return NextResponse.json({ biometrics: data });
    } else {
      const record = await insertRecord(body);
      const { data, error } = await supabase
        .from('researcher_biometrics')
        .insert(record)
        .select()
        .maybeSingle();

      if (error) throw error;
      return NextResponse.json({ biometric: data });
    }
  } catch (error: any) {
    console.error('Error logging biometric:', error);
    return NextResponse.json({ error: error.message || 'Failed to log biometric' }, { status: 400 });
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
