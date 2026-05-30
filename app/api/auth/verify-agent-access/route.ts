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
 * This is the CRITICAL gate that prevents cross-agent access.
 * The caller MUST be authenticated — we always use the session user id,
 * not a caller-supplied userId, to prevent IDOR enumeration.
 */
export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  // Require authentication — use session user, never trust caller-supplied userId
  const supabaseAuth = await createClient();
  const { data: { user } } = await supabaseAuth.auth.getUser();
  if (!user) return NextResponse.json({ allowed: false, reason: 'Not Authenticated' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { agentSlug } = body || {};

  if (!agentSlug) {
    return NextResponse.json({ allowed: false, reason: 'Missing Parameters' }, { status: 400 });
  }

  const supabase = await createServiceClient();

  // Resolve agent from slug
  const { data: agent } = await supabase
    .from('agent_profiles')
    .select('id')
    .ilike('slug', String(agentSlug))
    .maybeSingle();

  if (!agent) {
    return NextResponse.json({ allowed: false, reason: 'Agent Not Found' }, { status: 404 });
  }

  // Get authenticated user's own profile — always use session user.id, never caller-supplied userId
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, referring_agent_id, parent_agent_id, id')
    .eq('id', user.id)
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
