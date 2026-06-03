import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
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
 * SACA Phase 3: also accepts optional `subAgentId` (the id of a sub-agent
 * under the resolved agent). When present and valid, stamps
 * profiles.referring_sub_agent_id so every order the researcher places
 * later attributes commission to that sub-agent.
 *
 * Availability v2: also accepts optional `reservationToken` — when the
 * caller previously saw "This Name Is Available" on the live check, the
 * token (90s TTL) is consumed here so a competing signup can't race-in.
 *
 * Body: { slug, username, email?, password, firstName, lastName,
 *         subAgentId?, referralCode?, reservationToken? }
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
  const { slug, username, email, password, firstName, lastName, referralCode, subAgentId, reservationToken } = body || {};

  if (!slug || !username || !password || !firstName || !lastName) {
    return NextResponse.json(
      { error: 'Slug, Username, First Name, Last Name, And Password Are Required.' },
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

  const supabase = createAdminClient();

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

  // SACA Phase 3: optional sub-agent referral tag.
  // The sub-agent must exist, be flagged is_sub_agent=true, and have
  // parent_agent_id pointing to the agent who owns this storefront.
  let resolvedSubAgentId: string | null = null;
  if (subAgentId && typeof subAgentId === 'string' && subAgentId.trim().length > 0) {
    const { data: sa } = await supabase
      .from('profiles')
      .select('id, is_sub_agent, parent_agent_id')
      .eq('id', subAgentId.trim())
      .maybeSingle();

    if (!sa || sa.is_sub_agent !== true) {
      return NextResponse.json(
        { error: 'Referral Link Invalid: Sub-Agent Not Found.' },
        { status: 400 }
      );
    }
    if (sa.parent_agent_id !== agent.id) {
      return NextResponse.json(
        { error: 'Referral Link Invalid: Sub-Agent Does Not Sell On This Storefront.' },
        { status: 400 }
      );
    }
    resolvedSubAgentId = sa.id as string;
  }

  // Consume a soft reservation if the caller has one. Race winner here keeps
  // its claim narrowly ahead of any concurrent signup trying the same
  // username. Stale/expired tokens silently fail; the unique check below is
  // the final authority.
  if (typeof reservationToken === 'string' && /^[0-9a-f-]{36}$/i.test(reservationToken)) {
    try {
      await supabase.rpc('consume_slug_reservation', {
        p_token: reservationToken,
        p_field: 'username',
        p_normalized: usernameClean,
      });
    } catch (err) {
      console.warn('[storefront/register] consume_slug_reservation failed:', err);
    }
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
  // username@internal.auth convention so the existing username login path
  // keeps working.
  const internalEmail = `${usernameClean}@internal.auth`;

  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: internalEmail,
    password,
    email_confirm: true,
    user_metadata: { 
      username: usernameClean, 
      full_name: `${String(firstName).trim()} ${String(lastName).trim()}` 
    },
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
    email: null,
    username: usernameClean,
    full_name: `${String(firstName).trim()} ${String(lastName).trim()}`,
    first_name: String(firstName).trim(),
    last_name: String(lastName).trim(),
    role: 'researcher',
    referring_agent_id: agent.id,
    is_active: true,
    disclaimer_v1_accepted: true,
    disclaimer_accepted_at: nowIso,
    updated_at: nowIso,
  };
  if (resolvedSubAgentId) {
    profilePayload.referring_sub_agent_id = resolvedSubAgentId;
  }

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
    sub_agent_tagged: !!resolvedSubAgentId,
    referralWarning,
  });
}
