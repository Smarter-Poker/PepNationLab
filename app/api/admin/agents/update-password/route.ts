import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { requireAdmin } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';
import { rateLimit } from '@/lib/rate-limit';
import { AdminUpdatePasswordSchema } from '@/lib/schemas/auth';

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const gate = await requireAdmin();
  if (!gate.ok) return gate.response;

  // Rate-limit: 20 password resets / min per admin — prevents mass rotation from a compromised session.
  const rl = await rateLimit({ key: 'admin_update_password', limit: 20, windowSeconds: 60, identifier: gate.userId });
  if (!rl.allowed) return NextResponse.json({ error: 'Too Many Requests. Slow Down.' }, { status: 429 });

  const supabase = createAdminClient();
  const rawBody: unknown = await req.json().catch(() => ({}));

  // Schema-locked: newPassword must be a STRING of 8-128 chars and userId a
  // UUID. The previous hand check called `.length` on an untyped value, so a
  // non-string JSON value bypassed both length bounds.
  const parsed = AdminUpdatePasswordSchema.safeParse(rawBody);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const message = first?.path?.[0] === 'newPassword' && first.code !== 'invalid_type'
      ? first.message
      : 'Missing Required Fields';
    return NextResponse.json({ error: message }, { status: 400 });
  }
  const { userId, newPassword } = parsed.data;

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
