import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';

// POST /api/auth/change-password
// Used by researchers on first login to change their temp password.
// Also used to "skip" (clears the flag without changing password).
export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { newPassword, skip } = body;

  // Skip — just clear the flag, keep the existing password
  if (skip === true) {
    const admin = createAdminClient();
    await admin
      .from('profiles')
      .update({ must_change_password: false, updated_at: new Date().toISOString() })
      .eq('id', user.id);
    return NextResponse.json({ success: true });
  }

  // Change password
  if (!newPassword || typeof newPassword !== 'string') {
    return NextResponse.json({ error: 'New Password Is Required' }, { status: 400 });
  }
  if (newPassword.length < 6) {
    return NextResponse.json({ error: 'Password Must Be At Least 6 Characters' }, { status: 400 });
  }

  // Update the auth password
  const { error: pwError } = await supabase.auth.updateUser({ password: newPassword });
  if (pwError) {
    return NextResponse.json({ error: pwError.message || 'Failed To Update Password' }, { status: 500 });
  }

  // Clear the flag
  const admin = createAdminClient();
  await admin
    .from('profiles')
    .update({ must_change_password: false, updated_at: new Date().toISOString() })
    .eq('id', user.id);

  return NextResponse.json({ success: true });
}
