import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';
import { rateLimit, getClientIp } from '@/lib/rate-limit';

// POST /api/auth/change-password
// Used by researchers on first login to change their temp password.
// Also used to "skip" (clears the flag without changing password).
//
// fix-47: rate-limited 10/min/user. The skip path is cheap but a real
// password change hits Supabase auth + writes profiles — worth gating to
// deter abuse from a stolen session token.
export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const ip = getClientIp(req);
  const limited = await rateLimit({
    key: 'auth_change_password',
    limit: 10,
    windowSeconds: 60,
    identifier: user.id || ip,
  });
  if (!limited.allowed) {
    return NextResponse.json({ error: 'Rate Limit Exceeded' }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const { newPassword, skip } = body;

  if (skip === true) {
    const admin = createAdminClient();
    await admin
      .from('profiles')
      .update({ must_change_password: false, updated_at: new Date().toISOString() })
      .eq('id', user.id);
    return NextResponse.json({ success: true });
  }

  if (!newPassword || typeof newPassword !== 'string') {
    return NextResponse.json({ error: 'New Password Is Required' }, { status: 400 });
  }
  if (newPassword.length < 6) {
    return NextResponse.json({ error: 'Password Must Be At Least 6 Characters' }, { status: 400 });
  }

  const { error: pwError } = await supabase.auth.updateUser({ password: newPassword });
  if (pwError) {
    return NextResponse.json({ error: 'Failed To Update Password.' }, { status: 500 });
  }

  const admin = createAdminClient();
  await admin
    .from('profiles')
    .update({ must_change_password: false, updated_at: new Date().toISOString() })
    .eq('id', user.id);

  return NextResponse.json({ success: true });
}
