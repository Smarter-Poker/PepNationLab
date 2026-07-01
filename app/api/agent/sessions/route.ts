import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';
import { getClientIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('user_sessions')
    .select('id, device_name, user_agent, ip, last_seen, created_at, revoked_at')
    .eq('user_id', user.id)
    .is('revoked_at', null)
    .order('last_seen', { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: 'sessions_fetch_failed' }, { status: 500 });
  }

  return NextResponse.json({ sessions: data ?? [] });
}

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const ua = req.headers.get('user-agent') || 'Unknown';
  const ip = getClientIp(req);

  let deviceName = 'Unknown Device';
  if (ua.includes('Macintosh')) deviceName = 'Mac';
  else if (ua.includes('Windows')) deviceName = 'Windows PC';
  else if (ua.includes('iPhone')) deviceName = 'iPhone';
  else if (ua.includes('iPad')) deviceName = 'iPad';
  else if (ua.includes('Android')) deviceName = 'Android Device';

  const { error } = await supabase.from('user_sessions').insert({
    user_id: user.id,
    device_name: deviceName,
    user_agent: ua,
    ip: ip ? ip.split(',')[0].trim() : null
  });

  if (error) {
    return NextResponse.json({ error: 'session_record_failed' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { data: keepRow } = await supabase
    .from('user_sessions')
    .select('id')
    .eq('user_id', user.id)
    .is('revoked_at', null)
    .order('last_seen', { ascending: false })
    .limit(1)
    .maybeSingle();

  const nowIso = new Date().toISOString();

  let query = supabase
    .from('user_sessions')
    .update({ revoked_at: nowIso })
    .eq('user_id', user.id)
    .is('revoked_at', null);

  if (keepRow?.id) {
    query = query.neq('id', keepRow.id);
  }

  const { data, error } = await query.select('id');

  if (error) {
    return NextResponse.json({ error: 'sessions_revoke_failed' }, { status: 500 });
  }

  await supabase
    .rpc('log_account_event', {
      p_user_id: user.id,
      p_event: 'sessions_revoked_all_others',
      p_details: { kept: keepRow?.id ?? null, revoked_count: data?.length ?? 0 },
    })
    .then(() => null, () => null);

  return NextResponse.json({ revoked: data?.length ?? 0 });
}
