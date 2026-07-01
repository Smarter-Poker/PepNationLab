export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { sanitizeUsername } from '@/lib/usernames';
import { assertSameOrigin } from '@/lib/csrf';
import { notifyNewResearcher } from '@/lib/notify';

/**
 * POST /api/storefront/register
 *
 * Self-registration endpoint for researchers arriving at an agent storefront.
 * Rate-limited to 10 registrations per hour per IP to prevent abuse.
 * Uses createAdminClient (raw supabase-js) to bypass RLS on profile writes.
 */

// In-process rate limit store: ip -> list of timestamps
const rateLimitStore = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const RATE_LIMIT_MAX = 10;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const timestamps = (rateLimitStore.get(ip) || []).filter(
    (t) => now - t < RATE_LIMIT_WINDOW_MS
  );
  if (timestamps.length >= RATE_LIMIT_MAX) {
    return false;
  }
  timestamps.push(now);
  rateLimitStore.set(ip, timestamps);
  return true;
}

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  // Rate limiting by IP
  const forwarded = req.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0].trim() : 'unknown';
  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: 'Too Many Registrations. Please Try Again Later.' },
      { status: 429 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const { agentSlug, username, password, firstName, lastName, phone } = body || {};

  if (!agentSlug) {
    return NextResponse.json({ error: 'Agent Storefront Is Required.' }, { status: 400 });
  }

  if (!username || !password || !firstName || !lastName) {
    return NextResponse.json(
      { error: 'Username, Password, First Name, And Last Name Are Required.' },
      { status: 400 }
    );
  }

  if (password.length < 8) {
    return NextResponse.json(
      { error: 'Password Must Be At Least 8 Characters.' },
      { status: 400 }
    );
  }

  const usernameClean = sanitizeUsername(username);
  if (!usernameClean || usernameClean.length < 2) {
    return NextResponse.json(
      { error: 'Username Must Be At Least 2 Characters (Letters, Numbers, Underscores).' },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  // Resolve agent by slug
  const { data: agentProfile, error: agentErr } = await admin
    .from('agent_profiles')
    .select('id')
    .eq('slug', agentSlug)
    .maybeSingle();

  if (agentErr || !agentProfile) {
    return NextResponse.json({ error: 'Storefront Not Found.' }, { status: 404 });
  }

  // Verify the agent is active
  const { data: agentUser, error: agentUserErr } = await admin
    .from('profiles')
    .select('id, is_active')
    .eq('id', agentProfile.id)
    .maybeSingle();

  if (agentUserErr || !agentUser || !agentUser.is_active) {
    return NextResponse.json({ error: 'This Storefront Is Not Currently Active.' }, { status: 403 });
  }

  const referringAgentId: string = agentProfile.id;

  // Check username uniqueness
  const { data: existingUser } = await admin
    .from('profiles')
    .select('id')
    .ilike('username', usernameClean)
    .maybeSingle();

  if (existingUser) {
    return NextResponse.json({ error: 'That Username Is Already Taken.' }, { status: 400 });
  }

  const internalEmail = `${usernameClean}@internal.auth`;
  const fullName = `${String(firstName).trim()} ${String(lastName).trim()}`;

  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email: internalEmail,
    password,
    email_confirm: true,
    user_metadata: { username: usernameClean, full_name: fullName },
  });

  if (authError || !authData?.user) {
    console.error('[storefront/register] auth.admin.createUser error:', authError);
    return NextResponse.json(
      { error: authError?.message || 'Failed To Create Account. Please Try Again.' },
      { status: 500 }
    );
  }

  const newUserId = authData.user.id;

  const profilePayload: Record<string, unknown> = {
    id: newUserId,
    email: null,
    username: usernameClean,
    full_name: fullName,
    first_name: String(firstName).trim(),
    last_name: String(lastName).trim(),
    phone: phone ? String(phone).trim() : null,
    role: 'researcher',
    referring_agent_id: referringAgentId,
    disclaimer_v1_accepted: false,
    is_active: true,
    updated_at: new Date().toISOString(),
  };

  const { error: profileError } = await admin
    .from('profiles')
    .upsert(profilePayload, { onConflict: 'id' });

  if (profileError) {
    console.error('[storefront/register] profile upsert error:', profileError);
    await admin.auth.admin.deleteUser(newUserId);
    return NextResponse.json(
      { error: `Account Setup Failed. Please Try Again.` },
      { status: 500 }
    );
  }

  await notifyNewResearcher(admin, referringAgentId, fullName).catch(() => { /* ignore */ });

  return NextResponse.json({
    success: true,
    userId: newUserId,
    username: usernameClean,
  });
}
