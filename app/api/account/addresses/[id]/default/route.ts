import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

  const { data: target } = await supabase
    .from('saved_addresses')
    .select('id')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!target) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const { error: clearErr } = await supabase
    .from('saved_addresses')
    .update({ is_default: false })
    .eq('user_id', user.id);
  if (clearErr) return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });

  const { error: setErr } = await supabase
    .from('saved_addresses')
    .update({ is_default: true })
    .eq('id', id)
    .eq('user_id', user.id);
  if (setErr) return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });

  return NextResponse.json({ ok: true });
}
