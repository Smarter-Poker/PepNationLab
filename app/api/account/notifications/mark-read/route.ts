import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';

export const dynamic = 'force-dynamic';

/** POST /api/account/notifications/mark-read
 *  Body: { ids: number[] }  — mark specific notification IDs as read
 *  Body: { all: true }      — mark ALL notifications as read
 */
export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { ids?: number[]; all?: boolean } = {};
  try { body = await req.json(); } catch { /* ignore */ }

  const now = new Date().toISOString();

  if (body.all === true) {
    const { error } = await supabase
      .from('notifications')
      .update({ read_at: now })
      .eq('user_id', user.id)
      .is('read_at', null);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  const ids = Array.isArray(body.ids) ? body.ids.filter((id) => typeof id === 'number') : [];
  if (ids.length === 0) return NextResponse.json({ error: 'No IDs provided' }, { status: 400 });

  const { error } = await supabase
    .from('notifications')
    .update({ read_at: now })
    .eq('user_id', user.id)
    .in('id', ids)
    .is('read_at', null);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
