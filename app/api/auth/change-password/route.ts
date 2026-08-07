import { after, NextRequest, NextResponse } from 'next/server';
import { getSupabaseUrl } from '@/lib/supabase/url';
import { createServerClient } from '@supabase/ssr';
import { createAdminClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import { emailConfigured, sendPasswordChangedEmail } from '@/lib/email';
import { safeError } from '@/lib/api-error';
import { recordAuthEvent } from '@/lib/auth-events';
import { validatePassword } from '@/lib/password-policy';

// POST /api/auth/change-password
// Used by researchers on first login to change their temp password.
// Also used to "skip" (clears the flag without changing password).
//
// fix-47: rate-limited 10/min/user. The skip path is cheap but a real
// password change hits Supabase auth + writes profiles - worth gating to
// deter abuse from a stolen session token.
//
// PASSWORD RULE: at least 8 characters, via lib/password-policy. This route
// once demanded EXACTLY 8 while the page that posts here demanded at least
// 12 — a contradiction that made a first-login password change impossible.
// Do not restate a length literal here; import the policy.
export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  let response = NextResponse.json({ success: true });

  // Create a response-aware server client so cookies modified by auth.updateUser
  // are properly written to the outgoing HTTP headers returned to the browser.
  const supabase = createServerClient(
    getSupabaseUrl(),
    (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim(),
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            req.cookies.set({ name, value, ...options });
          });
          response = NextResponse.json({ success: true });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  let user = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data?.user ?? null;
  } catch (err) {
    console.error('getUser error in change-password API route:', err);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!user) {
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

  const admin = createAdminClient();

  if (skip === true) {
    const { error: profileErr } = await admin
      .from('profiles')
      .update({ must_change_password: false, updated_at: new Date().toISOString() })
      .eq('id', user.id);

    if (profileErr) {
      console.error('Profile flag update error:', profileErr);
      return NextResponse.json({ error: 'Failed To Update Profile Settings.' }, { status: 500 });
    }
    return response;
  }

  if (!newPassword || typeof newPassword !== 'string') {
    return NextResponse.json({ error: 'New Password Is Required' }, { status: 400 });
  }
  const policyError = validatePassword(newPassword);
  if (policyError) {
    return NextResponse.json({ error: policyError }, { status: 400 });
  }

  // Update password via the user client. This generates a new session and triggers setAll()
  // to update the session cookies in the response, keeping the user logged in.
  const { error: pwError } = await supabase.auth.updateUser({ password: newPassword });
  if (pwError) {
    // Allow-list the two known-safe, user-actionable validation messages;
    // everything else (GoTrue internals, rate-limit phrasing, session/AAL
    // details) is replaced with a stable generic message and logged.
    const msg = pwError.message || '';
    const safeMsg = /different from the old password/i.test(msg)
      ? 'Your New Password Must Be Different From Your Current Password.'
      : /at least|weak|strength/i.test(msg)
        ? 'Please Choose A Stronger Password And Try Again.'
        : null;
    return safeError('auth.change-password.updateUser', pwError, safeMsg ? 400 : 500, safeMsg ?? 'Failed To Update Password. Please Try Again.');
  }

  // Clear the must_change_password flag in the profiles table via the admin client.
  // SECURITY: do NOT persist the user's self-chosen password. It previously wrote
  // provisioned_password=newPassword in cleartext, which was then viewable by admins
  // and the referring agent -- a credential-confidentiality break. The temporary
  // admin-provisioned value is cleared here so no stale plaintext lingers after the
  // user sets their own private password.
  const { error: profileErr } = await admin
    .from('profiles')
    .update({ must_change_password: false, provisioned_password: null, updated_at: new Date().toISOString() })
    .eq('id', user.id);

  if (profileErr) {
    console.error('Profile flag update error:', profileErr);
    return NextResponse.json({ error: 'Failed To Update Profile Settings.' }, { status: 500 });
  }

  // Auth analytics (best-effort): a real password change occurred (not the skip
  // path, which returns earlier).
  await recordAuthEvent({
    event_type: 'password_changed',
    user_id: user.id,
    ip: getClientIp(req),
    user_agent: req.headers.get('user-agent'),
  });

  // Security alert: notify the account's verified email that the password
  // changed. Runs via after() so it cannot slow or fail the response; a user
  // whose session was stolen gets a signal instead of silence.
  try {
    if (emailConfigured()) {
      const { data: prof } = await admin
        .from('profiles')
        .select('contact_email, email_verified, full_name')
        .eq('id', user.id)
        .maybeSingle();
      if (prof?.contact_email && prof.email_verified) {
        after(
          sendPasswordChangedEmail({
            to: prof.contact_email,
            fullName: prof.full_name,
          }).catch(() => { /* best-effort */ })
        );
      }
    }
  } catch { /* best-effort */ }

  return response;
}
