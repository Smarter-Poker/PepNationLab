import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { rateLimit, getClientIp } from '@/lib/rate-limit';
import { assertSameOrigin } from '@/lib/csrf';

// POST /api/auth/resolve
// Takes a username, returns the auth email for that user.
// Called by the login form before signInWithPassword.
//
// SOURCE OF TRUTH = auth.users.email (NOT profiles.email).
// profiles.email is contact info that can legitimately differ from, or drift
// out of sync with, the account's actual auth login identity. Returning it
// would hand signInWithPassword an address that no auth user owns, producing a
// false "invalid credentials" failure even when the password is correct. We
// therefore look up the auth user by id and return the email auth actually
// uses. Falls back to the synthetic `${username}@internal.auth` identity that
// every username-based account is created with.
export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const ip = getClientIp(req);
  const limited = await rateLimit({
    key: 'auth_resolve',
    limit: 20,
    windowSeconds: 60,
    identifier: ip,
  });
  if (!limited.allowed) {
    return NextResponse.json(
      { error: 'Too Many Requests. Please Wait And Try Again.' },
      { status: 429 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const username = (body.username ?? '').trim().toLowerCase();

  if (!username) {
    return NextResponse.json({ error: 'Username Required' }, { status: 400 });
  }

  // Fallback: If it's an email format, allow them to log in directly via email
  if (username.includes('@')) {
    return NextResponse.json({ email: username });
  }

  try {
    const admin = createAdminClient();

    // Use .eq() not .ilike() — attacker-supplied username; underscore in
    // .ilike() is a LIKE wildcard that could match unintended accounts.
    const { data } = await admin
      .from('profiles')
      .select('id, username')
      .eq('username', username)
      .eq('is_active', true)
      .maybeSingle();

    if (!data) {
      // Do NOT reveal whether the username exists. Return a synthetic email so
      // the downstream password check fails uniformly with the same shape as a
      // wrong-password attempt on a real account.
      const safeUsername = username.toLowerCase().replace(/[^a-z0-9_.-]/g, '');
      return NextResponse.json({ email: `${safeUsername}@nodom.invalid` });
    }

    // The synthetic internal identity every username account is created with.
    // Used as the fallback if the auth lookup is unavailable.
    let resolvedEmail = `${data.username.toLowerCase()}@internal.auth`;

    // Authoritative: whatever email auth.users actually holds for this account.
    // This is the address signInWithPassword must receive. If a real email was
    // genuinely set on the auth user, this returns it; if profiles.email drifted
    // out of sync (e.g. a contact-info update that never reached auth), this
    // still returns the correct, working login email.
    try {
      const { data: authUser } = await admin.auth.admin.getUserById(data.id);
      if (authUser?.user?.email) {
        resolvedEmail = authUser.user.email;
      }
    } catch {
      // Auth admin lookup unavailable - fall back to the synthetic identity.
    }

    return NextResponse.json({ email: resolvedEmail });
  } catch (err) {
    console.error('[auth/resolve] POST error:', err);
    return NextResponse.json({ error: 'Internal Server Error.' }, { status: 500 });
  }
}
