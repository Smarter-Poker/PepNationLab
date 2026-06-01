import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';

export const dynamic = 'force-dynamic';

const ParamsSchema = z.object({ id: z.string().uuid() });

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const raw = await params;
  const parsed = ParamsSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_id' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const nowIso = new Date().toISOString();

  const { data, error } = await supabase
    .from('user_sessions')
    .update({ revoked_at: nowIso })
    .eq('id', parsed.data.id)
    .eq('user_id', user.id)
    .is('revoked_at', null)
    .select('id')
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: 'session_revoke_failed' }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: 'session_not_found' }, { status: 404 });
  }

  await supabase
    .rpc('log_account_event', {
      p_user_id: user.id,
      p_event: 'session_revoked',
      p_details: { session_id: parsed.data.id },
    })
    .then(() => null, () => null);

  return NextResponse.json({ revoked: true });
}
