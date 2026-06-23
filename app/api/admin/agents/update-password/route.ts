import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  const supabase = createAdminClient();
  const body = await req.json().catch(() => ({}));
  const { userId, newPassword } = body;

  if (!userId || !newPassword) {
    return NextResponse.json({ error: 'Missing Required Fields' }, { status: 400 });
  }
  if (newPassword.length < 8) {
    return NextResponse.json({ error: 'Password Must Be At Least 8 Characters' }, { status: 400 });
  }

  // Block resetting another admin's password - prevents horizontal privilege escalation.
  // Admins should use the Supabase dashboard or their own account settings for self-reset.
  const { data: targetProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle();

  if (targetProfile?.role === 'admin') {
    return NextResponse.json({ error: 'Cannot Reset Another Admin\'s Password Via This Route' }, { status: 403 });
  }

  const { error } = await supabase.auth.admin.updateUserById(userId, { password: newPassword });
  if (error) {
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }

  // Set must_change_password to true so they are forced to change it on their next login.
  // Also store the admin-set plaintext password in provisioned_password for admin UI display.
  const { error: profileErr } = await supabase
    .from('profiles')
    .update({
      must_change_password: true,
      provisioned_password: newPassword,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  if (profileErr) {
    console.error('Failed to set must_change_password flag:', profileErr);
  }

  return NextResponse.json({ success: true });
}
