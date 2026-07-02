export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { sanitizeUsername } from '@/lib/usernames';
import { assertSameOrigin } from '@/lib/csrf';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import { notifyNewResearcher } from '@/lib/notify';

/**
 * POST /api/storefront/register
 *
 * Self-registration endpoint for researchers arriving at an agent storefront.
 * Rate-limited to 10 registrations per hour per IP to prevent abuse.
 * Uses createAdminClient (raw supabase-js) to bypass RLS on profile writes.
 */

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  // Rate limiting by IP — use the shared persistent store (Supabase-backed) so
  // the limit holds across Vercel serverless invocations. An in-process Map
  // was previously used here but is always empty on cold starts, making the
  // limit completely ineffective.
  const ip = getClientIp(req);
  const limited = await rateLimit({
    key: 'storefront_register',
    limit: 10,
    windowSeconds: 3600, // 1 hour
    identifier: ip,
  });
  if (!limited.allowed) {
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

  // Field length caps — prevent oversized profile inserts.
  if (String(firstName).trim().length > 100 || String(lastName).trim().length > 100) {
    return NextResponse.json({ error: 'Name Must Be 100 Characters Or Fewer.' }, { status: 400 });
  }
  if (phone && String(phone).trim().length > 30) {
    return NextResponse.json({ error: 'Phone Number Is Too Long.' }, { status: 400 });
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

  try {
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

    // Check username uniqueness — use .eq() not .ilike() (underscore is a LIKE wildcard).
    const { data: existingUser } = await admin
      .from('profiles')
      .select('id')
      .eq('username', usernameClean)
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
  } catch (err) {
    console.error('[storefront/register] POST error:', err);
    return NextResponse.json(
      { error: 'Internal Server Error.' },
      { status: 500 }
    );
  }
}
