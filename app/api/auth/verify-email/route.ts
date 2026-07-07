export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import {
  hashCode,
  isValidEmail,
  normalizeEmail,
  CODE_PURPOSE_VERIFY_EMAIL,
  MAX_CODE_ATTEMPTS
} from '@/lib/verification';
import { emailConfigured } from '@/lib/email';

export async function POST(req: NextRequest) {
  // Rate limit
  const ip = getClientIp(req);
  const limited = await rateLimit({
    key: 'auth_verify_email',
    limit: 10,
    windowSeconds: 3600, // 1 hour
    identifier: ip,
  });

  if (!limited.allowed) {
    return NextResponse.json(
      { error: 'Too Many Verification Attempts. Please Try Again Later.' },
      { status: 429 }
    );
  }

  if (!emailConfigured()) {
    return NextResponse.json(
      { error: 'Email Services Are Currently Disabled.' },
      { status: 503 }
    );
  }

  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();

  if (authErr || !user) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const email = normalizeEmail(body?.email);
  const code = body?.code;

  if (!isValidEmail(email)) {
    return NextResponse.json({ error: 'A Valid Email Address Is Required.' }, { status: 400 });
  }

  if (!code || !/^\d{6}$/.test(String(code))) {
    return NextResponse.json({ error: 'Please Enter The 6-Digit Verification Code.' }, { status: 400 });
  }

  try {
    const admin = createAdminClient();

    // Find the code
    const { data: codeRow } = await admin
      .from('email_verification_codes')
      .select('id, code_hash, attempts, expires_at, consumed')
      .eq('email', email)
      .eq('purpose', CODE_PURPOSE_VERIFY_EMAIL)
      .eq('consumed', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!codeRow) {
      return NextResponse.json({ error: 'No Active Code. Please Request A New Verification Code.' }, { status: 400 });
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

    // Mark code as consumed
    await admin.from('email_verification_codes').update({ consumed: true }).eq('id', codeRow.id);

    // Update the profile with the new verified email
    const { error: updateErr } = await admin
      .from('profiles')
      .update({
        contact_email: email,
        email_verified: true,
      })
      .eq('id', user.id);

    if (updateErr) {
      console.error('[verify-email] profile update error:', updateErr);
      return NextResponse.json({ error: 'Failed To Update Profile.' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[verify-email] POST error:', err);
    return NextResponse.json(
      { error: 'Internal Server Error.' },
      { status: 500 }
    );
  }
}
