/**
 * POST   { compound_slug? | reference_id? }   enqueue
 * PATCH  { id, read_at?, position? }          mark read or reorder
 * DELETE { id }                                remove
 * GET                                          list user queue ordered by position
 */
import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';
import { safeError } from '@/lib/api-error';

export const dynamic = 'force-dynamic';

async function getUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function GET() {
  const { supabase, user } = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data, error } = await supabase
    .from('user_reading_queue')
    .select('id, compound_slug, reference_id, position, read_at, created_at')
    .order('position', { ascending: true })
    .limit(100);
  if (error) return safeError('research.reading_queue', error);
  return NextResponse.json({ queue: data ?? [] });
}

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;
  const { supabase, user } = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  let body: { compound_slug?: string; reference_id?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const compound_slug = body.compound_slug ? body.compound_slug.slice(0, 80) : null;
  const reference_id = body.reference_id ? body.reference_id.slice(0, 80) : null;
  if (!compound_slug && !reference_id) return NextResponse.json({ error: 'compound_slug or reference_id required' }, { status: 400 });
  // Get next position
  const { data: maxRow } = await supabase
    .from('user_reading_queue')
    .select('position')
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextPosition = ((maxRow?.position as number | undefined) ?? 0) + 1;
  const { data, error } = await supabase
    .from('user_reading_queue')
    .insert({ user_id: user.id, compound_slug, reference_id, position: nextPosition })
    .select('id, compound_slug, reference_id, position')
    .single();
  if (error) return safeError('research.reading_queue', error);
  return NextResponse.json({ queued: data });
}

export async function PATCH(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;
  const { supabase, user } = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  let body: { id?: string; read_at?: string | null; position?: number };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!body.id || typeof body.id !== 'string' || !UUID_REGEX.test(body.id)) return NextResponse.json({ error: 'A valid id is required' }, { status: 400 });

  const patch: Record<string, unknown> = {};
  if ('read_at' in body) patch.read_at = body.read_at;
  if (typeof body.position === 'number') patch.position = body.position;
  const { error } = await supabase.from('user_reading_queue').update(patch).eq('id', body.id).eq('user_id', user.id);
  if (error) return safeError('research.reading_queue', error);
  return new NextResponse(null, { status: 204 });
}

export async function DELETE(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;
  const { supabase, user } = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  let body: { id?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!body.id || typeof body.id !== 'string' || !UUID_REGEX.test(body.id)) return NextResponse.json({ error: 'A valid id is required' }, { status: 400 });

  const { error } = await supabase.from('user_reading_queue').delete().eq('id', body.id).eq('user_id', user.id);
  if (error) return safeError('research.reading_queue', error);
  return new NextResponse(null, { status: 204 });
}
