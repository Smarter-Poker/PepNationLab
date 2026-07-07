export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import { normalizeEmail } from '@/lib/verification';
import { emailConfigured, sendPasswordResetEmail } from '@/lib/email';

export async function POST(req: NextRequest) {
  // Rate limit: 5 requests per hour per IP.
  const ip = getClientIp(req);
  const limited = await rateLimit({
    key: 'auth_reset_password',
    limit: 5,
    windowSeconds: 3600, // 1 hour
    identifier: ip,
  });

  if (!limited.allowed) {
    return NextResponse.json(
      { error: 'Too Many Requests. Please Try Again Later.' },
      { status: 429 }
    );
  }

  if (!emailConfigured()) {
    return NextResponse.json(
      { error: 'Email Services Are Currently Disabled. Please Contact Your Agent.' },
      { status: 503 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const email = normalizeEmail(body?.email);

  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'A Valid Email Address Is Required.' }, { status: 400 });
  }

  try {
    const admin = createAdminClient();

    // Look up the user by contact_email
    const { data: profile, error: profileErr } = await admin
      .from('profiles')
      .select('id, username, full_name, is_active')
      .eq('contact_email', email)
      .maybeSingle();

    // To prevent email enumeration, we always return a success message even if the user isn't found
    if (!profileErr && profile && profile.is_active && profile.username) {
      const internalEmail = `${profile.username.toLowerCase()}@internal.auth`;

      // Generate the password reset link for the internal email
      // redirectTo handles where Supabase should redirect the user. We will handle
      // the hash parsing in app/reset-password/page.tsx or it will be handled by the default
      // Supabase PKCE flow. But since this is a recovery type, the link itself contains
      // #access_token=... and type=recovery.
      const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://pepnationlab.com';
      const redirectTo = `${siteUrl}/reset-password`;

      const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
        type: 'recovery',
        email: internalEmail,
        options: {
          redirectTo,
        }
      });

      if (!linkErr && linkData?.properties?.action_link) {
        const resetUrl = linkData.properties.action_link;

        await sendPasswordResetEmail({
          to: email,
          resetUrl,
          fullName: profile.full_name,
        });
      } else {
        console.error('[reset-password] generateLink failed:', linkErr);
      }
    } else {
      console.info(`[reset-password] ignoring request for unknown or inactive email: ${email}`);
    }

    // Always return success to prevent email enumeration
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[reset-password] POST error:', err);
    return NextResponse.json(
      { error: 'Internal Server Error.' },
      { status: 500 }
    );
  }
}
