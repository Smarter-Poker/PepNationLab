import { NextResponse, type NextRequest } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

/**
 * Guards admin-only API routes.
 *
 * Verifies that the current request is from an authenticated user whose
 * profile role is 'admin'. Admin API routes use the service-role client
 * (which bypasses Row Level Security), so this check is the ONLY thing
 * standing between the public internet and full admin write access.
 *
 * Usage in a route handler:
 *   const gate = await requireAdmin();
 *   if (!gate.ok) return gate.response;
 */
export async function requireAdmin(): Promise<
  | { ok: true; userId: string }
  | { ok: false; response: NextResponse }
> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Unauthorized. Please Sign In.' },
        { status: 401 }
      ),
    };
  }

  // Role lookup via service client so it is not affected by RLS visibility.
  // Audit9 fix: .maybeSingle() so a fresh auth user without a profiles row
  // does not crash the request with PGRST116.
  const service = await createServiceClient();
  const { data: profile } = await service
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (profile?.role !== 'admin') {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Forbidden. Admin Access Is Required.' },
        { status: 403 }
      ),
    };
  }

  return { ok: true, userId: user.id };
}

/**
 * Guards API routes that can be accessed by both Admins AND the Shipping role.
 */
export async function requireOrdersAccess(): Promise<
  | { ok: true; userId: string; role: string }
  | { ok: false; response: NextResponse }
> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  const service = await createServiceClient();
  const { data: profile } = await service
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (profile?.role !== 'admin' && profile?.role !== 'shipping') {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    };
  }

  return { ok: true, userId: user.id, role: profile.role };
}

/**
 * Guards API routes that can only be accessed by Agents (agent or super_agent).
 * Admins must use admin-prefixed routes; passing admin through here violates the
 * agent ownership assumption that all agent routes rely on (agent_id = callerId).
 */
export async function requireAgent(): Promise<
  | { ok: true; user: { id: string } }
  | { ok: false; response: NextResponse }
> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  const service = await createServiceClient();
  const { data: profile } = await service
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  // BUG 7 fix: removed 'admin' from the allowed set. Admins are not agents and
  // must not pass agent-scoped ownership checks with a mismatched callerId.
  if (profile?.role !== 'agent' && profile?.role !== 'super_agent') {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Forbidden. Agent Access Required.' }, { status: 403 }),
    };
  }

  return { ok: true, user: { id: user.id } };
}

/**
 * Guards agent-storefront routes that the ADMIN may also use on their OWN
 * house storefront (e.g. the admin Product Manager reuses the agent product
 * editor against the admin-owned main store).
 *
 * This does NOT reintroduce BUG 7: it is only safe for routes where every
 * query is scoped to agent_id = caller id, so an admin passing through can
 * only ever read or write the house store's own rows - never another
 * agent's. Do NOT use this on routes that accept a foreign agentId or that
 * perform cross-agent ownership checks; those must keep requireAgent /
 * requireAdmin separation.
 */
export async function requireAgentOrAdmin(): Promise<
  | { ok: true; user: { id: string }; isAdmin: boolean }
  | { ok: false; response: NextResponse }
> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  const service = await createServiceClient();
  const { data: profile } = await service
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  const role = profile?.role;
  if (role !== 'agent' && role !== 'super_agent' && role !== 'admin') {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Forbidden. Agent Access Required.' }, { status: 403 }),
    };
  }

  return { ok: true, user: { id: user.id }, isAdmin: role === 'admin' };
}

/**
 * Guards API routes that need ANY signed-in user (researcher / agent /
 * super_agent / admin). Returns the same { ok, user: { id }, response }
 * shape used by requireAgent so existing callers can swap freely.
 *
 * Used by surfaces that return user-scoped data and rely on the row-level
 * query (e.g. agent_id = user.id) to gate visibility, rather than role.
 * Researchers using these endpoints will simply get empty result sets.
 */
export async function requireSession(): Promise<
  | { ok: true; user: { id: string } }
  | { ok: false; response: NextResponse }
> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  return { ok: true, user: { id: user.id } };
}

/**
 * Guards high-sensitivity admin endpoints (EasyPost connect / rotate /
 * disconnect) by verifying that the authenticated admin completed an MFA
 * challenge within the last `windowMs` milliseconds.
 */
export async function assertMfaRecent(
  _req: NextRequest,
  windowMs: number = 5 * 60 * 1000,
): Promise<NextResponse | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized. Please Sign In.' },
      { status: 401 },
    );
  }

  // AMR (authentication methods reference) claims are NOT present on the
  // supabase-js Session object - reading (session as any).amr always yielded
  // undefined, so this guard used to return 403 unconditionally and made the
  // EasyPost connect/rotate/disconnect routes permanently unusable. The
  // methods (with per-method timestamps) are exposed only through the MFA
  // assurance-level API.
  const { data: aal, error: aalErr } =
    await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  const methods: Array<{ method: string; timestamp: number }> =
    aal?.currentAuthenticationMethods ?? [];
  if (aalErr || methods.length === 0) {
    return NextResponse.json(
      { error: 'Multi-Factor Authentication Required For This Action.' },
      { status: 403 },
    );
  }

  const mfaMethods = new Set(['totp', 'webauthn', 'recovery_code']);
  const cutoffSec = (Date.now() - windowMs) / 1000;
  const recentMfa = methods.some(
    (entry) => mfaMethods.has(entry.method) && entry.timestamp >= cutoffSec,
  );

  if (!recentMfa) {
    return NextResponse.json(
      { error: 'Recent Multi-Factor Authentication Required. Please Re-Authenticate.' },
      { status: 403 },
    );
  }

  return null;
}
