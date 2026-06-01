import { NextResponse, type NextRequest } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const nowIso = new Date().toISOString();
  const service = await createServiceClient();

  const { error: profileErr } = await service
    .from('profiles')
    .update({ is_active: false, deactivated_at: nowIso })
    .eq('id', user.id);

  if (profileErr) {
    return NextResponse.json({ error: 'deactivate_failed' }, { status: 500 });
  }

  await service
    .from('agent_profiles')
    .update({ is_active: false })
    .eq('id', user.id)
    .then(() => null, () => null);

  await service
    .rpc('log_account_event', {
      p_user_id: user.id,
      p_event: 'account_deactivated',
      p_details: { at: nowIso },
    })
    .then(() => null, () => null);

  await supabase.auth.signOut().catch(() => null);

  return NextResponse.json({ deactivated: true });
}
