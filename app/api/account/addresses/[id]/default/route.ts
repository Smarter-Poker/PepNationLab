import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';

/**
 * POST /api/account/addresses/[id]/default
 * Query: kind = 'to' | 'from'  (default 'to' for backwards compat)
 *
 * Sets the chosen address as default for one kind. Ensures the address is
 * actually eligible for that kind (is_ship_to / is_ship_from) and clears
 * the previous default of that kind for the same user.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const { id } = await params;
  const kindRaw = req.nextUrl.searchParams.get('kind') ?? 'to';
  const kind: 'to' | 'from' = kindRaw === 'from' ? 'from' : 'to';

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data: target } = await supabase
    .from('saved_addresses')
    .select('id, is_ship_to, is_ship_from')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!target) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  if (kind === 'to' && !target.is_ship_to) {
    return NextResponse.json({ error: 'not_eligible_for_ship_to' }, { status: 400 });
  }
  if (kind === 'from' && !target.is_ship_from) {
    return NextResponse.json({ error: 'not_eligible_for_ship_from' }, { status: 400 });
  }

  const defaultColumn = kind === 'to' ? 'is_default' : 'is_default_from';

  const { error: clearErr } = await supabase
    .from('saved_addresses')
    .update({ [defaultColumn]: false })
    .eq('user_id', user.id);
  if (clearErr) return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });

  const { error: setErr } = await supabase
    .from('saved_addresses')
    .update({ [defaultColumn]: true })
    .eq('id', id)
    .eq('user_id', user.id);
  if (setErr) return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });

  return NextResponse.json({ ok: true, kind });
}
