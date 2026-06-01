import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAgent } from '@/lib/admin-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/agent/me
 *
 * Returns the calling agent / super-agent's storefront profile so the
 * Coupons UI can build sharable links and QR codes that point at the
 * correct /{slug}?coupon=CODE URL. For sub-agents (role='agent',
 * is_sub_agent=true) we surface the parent super-agent's storefront,
 * since that is where their researchers' orders land.
 *
 * Admins editing on behalf of others get null fields — they should pass
 * an explicit slug from the page they came from.
 */
export async function GET() {
  const gate = await requireAgent();
  if (!gate.ok) return gate.response;

  const svc = await createServiceClient();
  const { data: profile } = await svc
    .from('profiles')
    .select('id, role, is_sub_agent, parent_agent_id')
    .eq('id', gate.user.id)
    .maybeSingle();

  if (!profile) {
    return NextResponse.json({ agent: null });
  }

  if (profile.role === 'admin') {
    return NextResponse.json({ agent: null, role: 'admin' });
  }

  // Resolve which agent_profiles row owns the storefront the caller belongs to.
  // - agent / super_agent (not sub) -> their own id
  // - sub_agent (role='agent' AND is_sub_agent=true) -> parent_agent_id
  const isSubAgent = (profile as { is_sub_agent?: boolean | null }).is_sub_agent === true;
  const storefrontOwnerId = isSubAgent ? profile.parent_agent_id : profile.id;

  if (!storefrontOwnerId) {
    return NextResponse.json({ agent: null, role: profile.role });
  }

  const { data: agent } = await svc
    .from('agent_profiles')
    .select('id, slug, display_name, primary_color, is_active')
    .eq('id', storefrontOwnerId)
    .maybeSingle();

  return NextResponse.json({
    agent: agent ?? null,
    role: profile.role,
    is_sub_agent: isSubAgent,
  });
}
