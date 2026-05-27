import { NextResponse } from 'next/server';
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

  if (profile?.role !== 'agent' && profile?.role !== 'admin') {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Forbidden. Agent Access Required.' }, { status: 403 }),
    };
  }

  return { ok: true, user: { id: user.id } };
}
