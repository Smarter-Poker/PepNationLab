import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { sanitizeUsername } from '@/lib/usernames';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import { assertSameOrigin } from '@/lib/csrf';

/**
 * POST /api/storefront/register
 *
 * Public, self-service researcher registration on an agent's branded
 * storefront. Resolves the agent by `agent_profiles.slug` (case-insensitive)
 * and ties the new researcher's `referring_agent_id` to that agent.
 *
 * Body: { slug, username, email?, password, fullName }
 *
 * Rate limited to 5 requests / IP / hour. Uses Upstash when available
 * (cluster-wide) and falls back to an in-memory ring buffer when not.
 */

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const ip = getClientIp(req);
  const limited = await rateLimit({
    key: 'storefront_register',
    limit: 5,
    windowSeconds: 3600,
    identifier: ip,
  });
  if (!limited.allowed) {
    return NextResponse.json(
      { error: 'Too Many Requests. Please Wait And Try Again.' },
      { status: 429 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const { slug, username, email, password, fullName, referralCode } = body || {};

  if (!slug || !username || !password || !fullName) {
    return NextResponse.json(
      { error: 'Slug, Username, Full Name, And Password Are Required.' },
      { status: 400 }
    );
  }

  if (typeof password !== 'string' || password.length < 8) {
    return NextResponse.json(
      { error: 'Password Must Be At Least 8 Characters.' },
      { status: 400 }
    );
  }

  const usernameClean = sanitizeUsername(String(username));
  if (!usernameClean || usernameClean.length < 2) {
    return NextResponse.json(
      { error: 'Username Must Be At Least 2 Characters (Letters, Numbers, Underscores).' },
      { status: 400 }
    );
  }

  const supabase = await createServiceClient();

  // Resolve agent by slug (case-insensitive)
  const { data: agent, error: agentErr } = await supabase
    .from('agent_profiles')
    .select('id, slug')
    .ilike('slug', String(slug))
    .maybeSingle();

  if (agentErr || !agent) {
    return NextResponse.json(
      { error: 'Storefront Not Found.' },
      { status: 404 }
    );
  }

  // Username uniqueness
  const { data: existingUser } = await supabase
    .from('profiles')
    .select('id')
    .ilike('username', usernameClean)
    .maybeSingle();

  if (existingUser) {
    return NextResponse.json(
      { error: 'That Username Is Already Taken.' },
      { status: 400 }
    );
  }

  // Internal email is what Supabase auth indexes against. Keep the
  // username@pepnationlab.com convention so the existing username login path
  // keeps working.
  const internalEmail = `${usernameClean}@pepnationlab.com`;

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: internalEmail,
    password,
    email_confirm: true,
  });

  if (authError || !authData?.user) {
    return NextResponse.json(
      { error: 'Failed To Create Account.' },
      { status: 500 }
    );
  }

  const newUserId = authData.user.id;
  const nowIso = new Date().toISOString();

  const profilePayload: Record<string, any> = {
    id: newUserId,
    email: internalEmail,
    username: usernameClean,
    full_name: String(fullName).trim(),
    role: 'researcher',
    referring_agent_id: agent.id,
    is_active: true,
    disclaimer_v1_accepted: true,
    disclaimer_accepted_at: nowIso,
    updated_at: nowIso,
  };

  const { error: profileError } = await supabase
    .from('profiles')
    .upsert(profilePayload);

  if (profileError) {
    await supabase.auth.admin.deleteUser(newUserId);
    return NextResponse.json(
      { error: 'Profile Creation Failed.' },
      { status: 500 }
    );
  }

  // Audit log: registration disclaimer acceptance.
  const disclaimerVersion = process.env.NEXT_PUBLIC_DISCLAIMER_VERSION || 'v1.0';
  await supabase.from('disclaimer_acceptances').insert({
    user_id: newUserId,
    disclaimer_version: disclaimerVersion,
    layer: 'registration',
    ip_address: ip,
    user_agent: req.headers.get('user-agent') || null,
    accepted_at: nowIso,
  });

  // Optional referral code (?ref=<code>). Non-blocking — any failure is
  // surfaced as a warning in the response but never aborts signup.
  let referralWarning: string | null = null;
  if (referralCode && typeof referralCode === 'string') {
    const trimmed = referralCode.trim();
    if (trimmed && trimmed.length <= 32) {
      const { error: refError } = await supabase.rpc('apply_referral_code', {
        p_referee_id: newUserId,
        p_code: trimmed,
      });
      if (refError) referralWarning = refError.message || 'Could Not Apply Referral Code';
    }
  }

  return NextResponse.json({
    success: true,
    userId: newUserId,
    username: usernameClean,
    email: internalEmail,
    referralWarning,
  });
}
