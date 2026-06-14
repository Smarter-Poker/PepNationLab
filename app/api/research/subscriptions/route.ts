/**
 * POST   { compound_slug, notify_new_evidence?, notify_wada_change?, notify_recall?, notify_trial_status? }  subscribe / upsert
 * PATCH  { compound_slug, notify_new_evidence?, notify_wada_change?, notify_recall?, notify_trial_status? }  toggle
 * DELETE { compound_slug }                                                                                    unsubscribe
 * GET                                                                                                         list
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
    .from('user_compound_subscriptions')
    .select('compound_slug, notify_new_evidence, notify_wada_change, notify_recall, notify_trial_status, created_at')
    .order('created_at', { ascending: false });
  if (error) return safeError('research.subscriptions', error);
  return NextResponse.json({ subscriptions: data ?? [] });
}

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;
  const { supabase, user } = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  let body: { compound_slug?: string; notify_new_evidence?: boolean; notify_wada_change?: boolean; notify_recall?: boolean; notify_trial_status?: boolean };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const compound_slug = (body.compound_slug ?? '').slice(0, 80).trim();
  if (!compound_slug) return NextResponse.json({ error: 'compound_slug required' }, { status: 400 });
  const row = {
    user_id: user.id,
    compound_slug,
    notify_new_evidence: body.notify_new_evidence ?? true,
    notify_wada_change: body.notify_wada_change ?? false,
    notify_recall: body.notify_recall ?? true,
    notify_trial_status: body.notify_trial_status ?? false,
  };
  const { data, error } = await supabase
    .from('user_compound_subscriptions')
    .upsert(row, { onConflict: 'user_id,compound_slug' })
    .select('compound_slug, notify_new_evidence, notify_wada_change, notify_recall, notify_trial_status')
    .single();
  if (error) return safeError('research.subscriptions', error);
  return NextResponse.json({ subscription: data });
}

export async function PATCH(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;
  const { supabase, user } = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  let body: { compound_slug?: string; notify_new_evidence?: boolean; notify_wada_change?: boolean; notify_recall?: boolean; notify_trial_status?: boolean };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const compound_slug = (body.compound_slug ?? '').slice(0, 80).trim();
  if (!compound_slug) return NextResponse.json({ error: 'compound_slug required' }, { status: 400 });
  // Read existing row first to avoid overwriting unmentioned prefs
  const { data: existing } = await supabase
    .from('user_compound_subscriptions')
    .select('notify_new_evidence, notify_wada_change, notify_recall, notify_trial_status')
    .eq('user_id', user.id)
    .eq('compound_slug', compound_slug)
    .maybeSingle();
  const merged = {
    user_id: user.id,
    compound_slug,
    notify_new_evidence: 'notify_new_evidence' in body ? body.notify_new_evidence : (existing?.notify_new_evidence ?? true),
    notify_wada_change: 'notify_wada_change' in body ? body.notify_wada_change : (existing?.notify_wada_change ?? false),
    notify_recall: 'notify_recall' in body ? body.notify_recall : (existing?.notify_recall ?? true),
    notify_trial_status: 'notify_trial_status' in body ? body.notify_trial_status : (existing?.notify_trial_status ?? false),
  };
  const { data, error } = await supabase
    .from('user_compound_subscriptions')
    .upsert(merged, { onConflict: 'user_id,compound_slug' })
    .select('compound_slug, notify_new_evidence, notify_wada_change, notify_recall, notify_trial_status')
    .single();
  if (error) return safeError('research.subscriptions', error);
  return NextResponse.json({ subscription: data });
}

export async function DELETE(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;
  const { supabase, user } = await getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  let body: { compound_slug?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const compound_slug = (body.compound_slug ?? '').trim();
  if (!compound_slug) return NextResponse.json({ error: 'compound_slug required' }, { status: 400 });
  // Scope the delete to the caller's own subscription (defense-in-depth beyond RLS).
  const { error } = await supabase
    .from('user_compound_subscriptions')
    .delete()
    .eq('user_id', user.id)
    .eq('compound_slug', compound_slug);
  if (error) return safeError('research.subscriptions', error);
  return new NextResponse(null, { status: 204 });
}
