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
  const service = await createServiceClient();
  const { data: profile } = await service
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

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
    .single();

  if (profile?.role !== 'admin' && profile?.role !== 'shipping') {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    };
  }

  return { ok: true, userId: user.id, role: profile.role };
}

/**
 * Guards API routes that can be accessed by Agents (or Admins).
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
    .single();

  if (profile?.role !== 'agent' && profile?.role !== 'super_agent' && profile?.role !== 'admin') {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Forbidden. Agent Access Required.' }, { status: 403 }),
    };
  }

  return { ok: true, user: { id: user.id } };
}

/**
 * Guards high-sensitivity admin endpoints (Shippo connect / rotate /
 * disconnect) by verifying that the authenticated admin completed an MFA
 * challenge within the last `windowMs` milliseconds.
 *
 * The Supabase `auth.mfa_amr_claims` view lists every authenticated method
 * for the current JWT. We look for a TOTP or webauthn entry whose timestamp
 * is within the window.
 *
 * @param req     The incoming Next.js request (used only for context here).
 * @param windowMs  Maximum age of the MFA assertion in milliseconds (default 5 min).
 * @returns null when MFA is recent enough, NextResponse 403 otherwise.
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

  // Retrieve AMR (Authentication Method Reference) claims from the session.
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json(
      { error: 'No Active Session.' },
      { status: 401 },
    );
  }

  // The AMR array is embedded in the JWT. Each entry has { method, timestamp }.
  // We look for a MFA method (totp, webauthn, recovery) within the window.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const amr: Array<{ method: string; timestamp: number }> = (session as any).user?.amr ?? [];
  if (!Array.isArray(amr) || amr.length === 0) {
    return NextResponse.json(
      { error: 'Multi-Factor Authentication Required For This Action.' },
      { status: 403 },
    );
  }

  const mfaMethods = new Set(['totp', 'webauthn', 'recovery_code']);
  const cutoffSec = (Date.now() - windowMs) / 1000;
  const recentMfa = amr.some(
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
