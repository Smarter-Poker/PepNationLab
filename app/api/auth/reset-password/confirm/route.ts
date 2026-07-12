export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import { emailConfigured, sendPasswordChangedEmail } from '@/lib/email';
import {
  normalizeEmail,
  isValidEmail,
  hashCode,
  CODE_PURPOSE_PASSWORD_RESET,
  MAX_CODE_ATTEMPTS,
} from '@/lib/verification';

/**
 * POST /api/auth/reset-password/confirm  (STEP 2 of code-based reset)
 *
 * Verifies the 6-digit reset code against the account's verified contact email
 * and, on success, sets the new password via the admin API. Enumeration-safe
 * error copy; attempt- and rate-limited.
 */
export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const ip = getClientIp(req);
  const limited = await rateLimit({
    key: 'auth_reset_password_confirm',
    limit: 10,
    windowSeconds: 3600,
    identifier: ip,
  });
  if (!limited.allowed) {
    return NextResponse.json({ error: 'Too Many Attempts. Please Try Again Later.' }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const email = normalizeEmail(body?.email);
  const code = body?.code;
  const newPassword = String(body?.newPassword ?? '');

  if (!isValidEmail(email)) {
    return NextResponse.json({ error: 'A Valid Email Address Is Required.' }, { status: 400 });
  }
  if (!code || !/^\d{6}$/.test(String(code))) {
    return NextResponse.json({ error: 'Please Enter The 6-Digit Reset Code.' }, { status: 400 });
  }
  if (newPassword.length < 8 || newPassword.length > 128) {
    return NextResponse.json({ error: 'Password Must Be Between 8 And 128 Characters.' }, { status: 400 });
  }

  try {
    const admin = createAdminClient();

    const { data: profile } = await admin
      .from('profiles')
      .select('id, is_active')
      .eq('contact_email', email)
      .maybeSingle();

    if (!profile || !profile.is_active) {
      // Generic message: do not reveal whether the account exists.
      return NextResponse.json({ error: 'Invalid Or Expired Code. Please Request A New One.' }, { status: 400 });
    }

    const { data: codeRow } = await admin
      .from('email_verification_codes')
      .select('id, code_hash, attempts, expires_at, consumed')
      .eq('email', email)
      .eq('purpose', CODE_PURPOSE_PASSWORD_RESET)
      .eq('consumed', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!codeRow) {
      return NextResponse.json({ error: 'No Active Code. Please Request A New Reset Code.' }, { status: 400 });
    }
    if (new Date(codeRow.expires_at).getTime() < Date.now()) {
      return NextResponse.json({ error: 'Your Code Has Expired. Please Request A New One.' }, { status: 400 });
    }
    if ((codeRow.attempts ?? 0) >= MAX_CODE_ATTEMPTS) {
      return NextResponse.json({ error: 'Too Many Incorrect Attempts. Please Request A New Code.' }, { status: 429 });
    }

    const matches = hashCode(String(code), email) === codeRow.code_hash;
    if (!matches) {
      await admin
        .from('email_verification_codes')
        .update({ attempts: (codeRow.attempts ?? 0) + 1 })
        .eq('id', codeRow.id);
      return NextResponse.json({ error: 'Incorrect Code. Please Try Again.' }, { status: 400 });
    }

    // Set the new password on the account's auth user.
    const { error: pwErr } = await admin.auth.admin.updateUserById(profile.id, { password: newPassword });
    if (pwErr) {
      console.error('[reset-password/confirm] updateUserById error:', pwErr);
      return NextResponse.json({ error: 'Could Not Update Password. Please Try Again.' }, { status: 500 });
    }

    // Consume the code so it cannot be reused.
    await admin.from('email_verification_codes').update({ consumed: true }).eq('id', codeRow.id);

    // Security alert: confirm the change to the same verified inbox that
    // received the reset code. Best-effort; never breaks the reset.
    try {
      if (emailConfigured()) {
        await sendPasswordChangedEmail({ to: email }).catch(() => { /* best-effort */ });
      }
    } catch { /* best-effort */ }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[reset-password/confirm] POST error:', err);
    return NextResponse.json({ error: 'Internal Server Error.' }, { status: 500 });
  }
}
