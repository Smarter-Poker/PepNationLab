import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getEffectiveUser } from '@/lib/impersonation';
import { assertSameOrigin } from '@/lib/csrf';
import { PUSH_TYPE_KEYS } from '@/lib/push-prefs';

export const dynamic = 'force-dynamic';

type Row = { push_enabled: boolean | null; push_type_prefs: Record<string, boolean> | null } | null;

async function loadRow(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<Row> {
  const { data } = await supabase
    .from('notification_preferences')
    .select('push_enabled, push_type_prefs')
    .eq('user_id', userId)
    .maybeSingle();
  return (data ?? null) as Row;
}

function shape(row: Row) {
  const map =
    row?.push_type_prefs && typeof row.push_type_prefs === 'object'
      ? row.push_type_prefs
      : {};
  return { push_enabled: !!row?.push_enabled, push_type_prefs: map };
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await getEffectiveUser(supabase);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let row = await loadRow(supabase, user.id);
  if (!row) {
    await supabase
      .from('notification_preferences')
      .upsert({ user_id: user.id }, { onConflict: 'user_id' });
    row = await loadRow(supabase, user.id);
  }
  return NextResponse.json(shape(row));
}

export async function PATCH(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const supabase = await createClient();
  const { data: { user } } = await getEffectiveUser(supabase);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON Body.' }, { status: 400 });
  }

  // Start from the current map and apply the incoming change(s).
  const current = await loadRow(supabase, user.id);
  const map: Record<string, boolean> =
    current?.push_type_prefs && typeof current.push_type_prefs === 'object'
      ? { ...current.push_type_prefs }
      : {};

  const applyOne = (key: unknown, enabled: unknown): boolean => {
    if (typeof key !== 'string' || !PUSH_TYPE_KEYS.has(key)) return false;
    if (typeof enabled !== 'boolean') return false;
    // Default-on storage: persist only opt-outs, so an absent key reads as ON.
    if (enabled) delete map[key];
    else map[key] = false;
    return true;
  };

  let changed = false;
  if (typeof body.key !== 'undefined') {
    changed = applyOne(body.key, body.enabled);
  } else if (body.push_type_prefs && typeof body.push_type_prefs === 'object') {
    for (const [k, v] of Object.entries(body.push_type_prefs as Record<string, unknown>)) {
      if (applyOne(k, v)) changed = true;
    }
  }
  if (!changed) {
    return NextResponse.json({ error: 'No Valid Push Type To Update.' }, { status: 400 });
  }

  const { error } = await supabase
    .from('notification_preferences')
    .upsert(
      { user_id: user.id, push_type_prefs: map, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    );
  if (error) {
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }

  return NextResponse.json(shape(await loadRow(supabase, user.id)));
}
