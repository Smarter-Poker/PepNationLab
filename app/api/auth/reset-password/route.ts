export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import {
  normalizeEmail,
  isValidEmail,
  generateCode,
  hashCode,
  codeExpiryDate,
  CODE_PURPOSE_PASSWORD_RESET,
} from '@/lib/verification';
import { emailConfigured, sendPasswordResetCodeEmail } from '@/lib/email';

/**
 * POST /api/auth/reset-password  (STEP 1 of code-based reset)
 *
 * Emails a single-use 6-digit reset code to the account's VERIFIED contact
 * email. Code-based (not a magic link) because the auth identity is a synthetic
 * <username>@internal.auth address, so Supabase's own recovery email cannot
 * reach the researcher; we deliver a code to their real, verified contact_email
 * and complete the reset in /api/auth/reset-password/confirm.
 *
 * Always returns { success: true } to prevent email enumeration.
 */
export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const ip = getClientIp(req);
  const limited = await rateLimit({
    key: 'auth_reset_password',
    limit: 5,
    windowSeconds: 3600, // 1 hour
    identifier: ip,
  });
  if (!limited.allowed) {
    return NextResponse.json({ error: 'Too Many Requests. Please Try Again Later.' }, { status: 429 });
  }

  if (!emailConfigured()) {
    return NextResponse.json(
      { error: 'Password Reset By Email Is Not Available Yet. Please Contact Your Agent.' },
      { status: 503 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const email = normalizeEmail(body?.email);

  if (!isValidEmail(email)) {
    return NextResponse.json({ error: 'A Valid Email Address Is Required.' }, { status: 400 });
  }

  try {
    const admin = createAdminClient();

    // Only issue a code for an active account with a VERIFIED contact email.
    const { data: profile } = await admin
      .from('profiles')
      .select('id, full_name, is_active, email_verified')
      .eq('contact_email', email)
      .maybeSingle();

    if (profile && profile.is_active && profile.email_verified) {
      const code = generateCode();
      const code_hash = hashCode(code, email);

      // Invalidate prior outstanding reset codes for this email.
      await admin
        .from('email_verification_codes')
        .delete()
        .eq('email', email)
        .eq('purpose', CODE_PURPOSE_PASSWORD_RESET)
        .eq('consumed', false);

      const { error: insertErr } = await admin.from('email_verification_codes').insert({
        email,
        code_hash,
        purpose: CODE_PURPOSE_PASSWORD_RESET,
        expires_at: codeExpiryDate().toISOString(),
      });

      if (!insertErr) {
        await sendPasswordResetCodeEmail({ to: email, code, fullName: profile.full_name });
      } else {
        console.error('[reset-password] code insert error:', insertErr);
      }
    } else {
      console.info('[reset-password] ignoring request for unknown / inactive / unverified email');
    }

    // Enumeration-safe: always success.
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[reset-password] POST error:', err);
    return NextResponse.json({ error: 'Internal Server Error.' }, { status: 500 });
  }
}
