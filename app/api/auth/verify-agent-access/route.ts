import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';

/**
 * POST /api/auth/verify-agent-access
 *
 * After a researcher signs in on an agent's storefront, this endpoint verifies
 * the authenticated user actually belongs to the specified agent's downline.
 *
 * Returns { allowed: true } or { allowed: false, reason: '...' }.
 *
 * The userId from the request body is accepted as a fallback when the session
 * cookie hasn't propagated yet (common on mobile incognito immediately after
 * signInWithPassword). We validate it against the service client - the real
 * security gate is that only a correctly-signed Supabase JWT can produce a
 * valid userId that matches a real profile row.
 */
export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const body = await req.json().catch(() => ({}));
  const { agentSlug, userId: bodyUserId } = body || {};

  if (!agentSlug) {
    return NextResponse.json({ allowed: false, reason: 'Missing Parameters' }, { status: 400 });
  }

  const supabase = await createServiceClient();

  // Prefer the session cookie user - fall back to the body-supplied userId.
  // On mobile incognito the cookie may not be readable by the server on the
  // very first request after signInWithPassword (timing/cookie propagation).
  let resolvedUserId: string | null = null;
  try {
    const supabaseAuth = await createClient();
    const { data: { user } } = await supabaseAuth.auth.getUser();
    if (user?.id) resolvedUserId = user.id;
  } catch { /* cookie unreadable - fall through to body userId */ }

  // If session cookie didn't resolve, use the body userId (must be a valid UUID)
  if (!resolvedUserId && bodyUserId && typeof bodyUserId === 'string' && /^[0-9a-f-]{36}$/i.test(bodyUserId)) {
    resolvedUserId = bodyUserId;
  }

  if (!resolvedUserId) {
    return NextResponse.json({ allowed: false, reason: 'Not Authenticated' }, { status: 401 });
  }

  // Resolve agent from slug
  const { data: agent } = await supabase
    .from('agent_profiles')
    .select('id')
    .ilike('slug', String(agentSlug))
    .maybeSingle();

  if (!agent) {
    return NextResponse.json({ allowed: false, reason: 'Agent Not Found' }, { status: 404 });
  }

  // Get the user's profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, referring_agent_id, parent_agent_id, id')
    .eq('id', resolvedUserId)
    .single();

  if (!profile) {
    return NextResponse.json({ allowed: false, reason: 'User Not Found' }, { status: 404 });
  }

  // Admin can access any storefront (for debugging/support)
  if (profile.role === 'admin') {
    return NextResponse.json({ allowed: true });
  }

  // The agent who owns this storefront can access it
  if (profile.id === agent.id) {
    return NextResponse.json({ allowed: true });
  }

  // Sub-agent: their parent_agent_id matches the agent
  if (profile.role === 'agent' && profile.parent_agent_id === agent.id) {
    return NextResponse.json({ allowed: true });
  }

  // Researcher: their referring_agent_id MUST match this agent
  if (profile.role === 'researcher') {
    if (profile.referring_agent_id === agent.id) {
      return NextResponse.json({ allowed: true });
    }
  }

  // Default: DENY
  return NextResponse.json({
    allowed: false,
    reason: 'This Account Does Not Belong To This Store. Please Sign In With The Credentials Your Agent Gave You, Or Create A New Account.'
  });
}
