export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import { emailConfigured, sendVerificationCodeEmail } from '@/lib/email';
import {
  generateCode,
  hashCode,
  isValidEmail,
  normalizeEmail,
  codeExpiryDate,
  CODE_PURPOSE_SIGNUP,
  CODE_PURPOSE_VERIFY_EMAIL,
} from '@/lib/verification';

/**
 * POST /api/auth/request-code
 *
 * Issues a single-use 6-digit email verification code for public signup.
 * - If the email sender is NOT configured yet, returns verification_required=false
 *   so the client proceeds to create the account with an unverified email
 *   (signups never break before email is wired).
 * - If configured, generates + stores a hashed code (invalidating prior ones for
 *   that email) and emails it.
 *
 * Responses never reveal whether an email is already in use.
 */
export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const ip = getClientIp(req);
  const ipLimit = await rateLimit({ key: 'request_code_ip', limit: 8, windowSeconds: 600, identifier: ip });
  if (!ipLimit.allowed) {
    return NextResponse.json({ error: 'Too Many Requests. Please Try Again Shortly.' }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const email = normalizeEmail(body?.email);
  const purpose = body?.purpose === CODE_PURPOSE_VERIFY_EMAIL ? CODE_PURPOSE_VERIFY_EMAIL : CODE_PURPOSE_SIGNUP;

  if (!isValidEmail(email)) {
    return NextResponse.json({ error: 'Please Enter A Valid Email Address.' }, { status: 400 });
  }

  // Sender not configured -> no code path; client creates the account directly
  // and the email is stored unverified until the sender is live.
  if (!emailConfigured()) {
    return NextResponse.json({ ok: true, verification_required: false });
  }

  // Per-email throttle so one address can't be spammed with codes.
  const emailLimit = await rateLimit({ key: `request_code_${purpose}_email`, limit: 4, windowSeconds: 600, identifier: email });
  if (!emailLimit.allowed) {
    return NextResponse.json({ error: 'Too Many Codes Requested For This Email. Please Wait A Few Minutes.' }, { status: 429 });
  }

  try {
    const admin = createAdminClient();
    const code = generateCode();
    const code_hash = hashCode(code, email);

    // Invalidate any prior outstanding codes for this email + purpose.
    await admin
      .from('email_verification_codes')
      .delete()
      .eq('email', email)
      .eq('purpose', purpose)
      .eq('consumed', false);

    const { error: insertErr } = await admin.from('email_verification_codes').insert({
      email,
      code_hash,
      purpose,
      expires_at: codeExpiryDate().toISOString(),
    });
    if (insertErr) {
      console.error('[request-code] insert error:', insertErr);
      return NextResponse.json({ error: 'Could Not Send Code. Please Try Again.' }, { status: 500 });
    }

    const sent = await sendVerificationCodeEmail({ to: email, code });
    if (!sent.ok) {
      return NextResponse.json({ error: 'Could Not Send Code. Please Check The Email And Try Again.' }, { status: 502 });
    }

    return NextResponse.json({ ok: true, verification_required: true, sent: true });
  } catch (err) {
    console.error('[request-code] error:', err);
    return NextResponse.json({ error: 'Internal Server Error.' }, { status: 500 });
  }
}
