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

  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '100'), 500);

  const { data, error } = await supabase
    .from('researcher_symptoms')
    .select('id, symptom_name, severity, notes, logged_at')
    .eq('user_id', user.id)
    .order('logged_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching symptoms:', error);
    return NextResponse.json({ error: 'Failed to fetch symptoms' }, { status: 500 });
  }

  return NextResponse.json({ symptoms: data ?? [] });
}

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rl = await rateLimit({
    key: 'researcher_symptom',
    limit: 60,
    windowSeconds: 60,
    identifier: user.id || getClientIp(req),
  });
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too Many Requests' }, { status: 429 });
  }

  let body: { symptom_name?: unknown; severity?: unknown; notes?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const symptom_name = typeof body.symptom_name === 'string' ? body.symptom_name.trim().slice(0, 200) : '';
  const severity = typeof body.severity === 'number' ? Math.min(10, Math.max(1, Math.round(body.severity))) : null;
  const notes = typeof body.notes === 'string' ? body.notes.trim().slice(0, 2000) : null;

  if (!symptom_name) {
    return NextResponse.json({ error: 'symptom_name is required' }, { status: 400 });
  }
  if (severity === null || isNaN(severity)) {
    return NextResponse.json({ error: 'severity must be a number 1-10' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('researcher_symptoms')
    .insert({ user_id: user.id, symptom_name, severity, notes })
    .select('id, symptom_name, severity, notes, logged_at')
    .single();

  if (error) {
    console.error('Error saving symptom:', error);
    return NextResponse.json({ error: 'Failed to save symptom' }, { status: 500 });
  }

  return NextResponse.json({ symptom: data }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const { error } = await supabase
    .from('researcher_symptoms')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  return NextResponse.json({ ok: true });
}
