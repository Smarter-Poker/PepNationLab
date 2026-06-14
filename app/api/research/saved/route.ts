/**
 * POST   { compound_slug, collection_name?, notes? }  add to collection
 * DELETE { compound_slug, collection_name? }          remove from collection
 * GET    ?collection=name                              list current user's saved
 *
 * All operations are auth-gated; RLS owner_select / owner_write enforce that
 * users can only read or mutate their own rows.
 */
import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { safeError } from '@/lib/api-error';

export const dynamic = 'force-dynamic';

async function getUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function GET(req: NextRequest) {
  const { supabase, user } = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const collection = req.nextUrl.searchParams.get('collection');
  let q = supabase.from('user_saved_compounds').select('id, compound_slug, collection_name, notes, created_at').order('created_at', { ascending: false });
  if (collection) q = q.eq('collection_name', collection);
  const { data, error } = await q;
  if (error) return safeError('research.saved', error);
  return NextResponse.json({ saved: data ?? [] });
}

export async function POST(req: NextRequest) {
  const { supabase, user } = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  let body: { compound_slug?: string; collection_name?: string; notes?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const compound_slug = (body.compound_slug ?? '').trim();
  if (!compound_slug || compound_slug.length > 80) return NextResponse.json({ error: 'compound_slug required' }, { status: 400 });
  const collection_name = (body.collection_name ?? 'Default').slice(0, 60);
  const notes = body.notes ? body.notes.slice(0, 500) : null;
  const { data, error } = await supabase
    .from('user_saved_compounds')
    .upsert({ user_id: user.id, compound_slug, collection_name, notes }, { onConflict: 'user_id,compound_slug,collection_name' })
    .select('id, compound_slug, collection_name')
    .single();
  if (error) return safeError('research.saved', error);
  return NextResponse.json({ saved: data });
}

export async function DELETE(req: NextRequest) {
  const { supabase, user } = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  let body: { compound_slug?: string; collection_name?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const compound_slug = (body.compound_slug ?? '').trim();
  if (!compound_slug) return NextResponse.json({ error: 'compound_slug required' }, { status: 400 });
  const collection_name = body.collection_name ?? 'Default';
  const { error } = await supabase
    .from('user_saved_compounds')
    .delete()
    .eq('compound_slug', compound_slug)
    .eq('collection_name', collection_name);
  if (error) return safeError('research.saved', error);
  return new NextResponse(null, { status: 204 });
}
