import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { requireAgent } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';
import { notifyPromotedToAgent, notifyPromotionSuccess } from '@/lib/notify';

/**
 * POST /api/agent/promote-subagent
 *
 * Promotes a researcher in the super agent's downline to a sub-agent.
 *
 * Rules enforced:
 * - Caller must be a Super Agent (is_super_agent = true)
 * - Target researcher's referring_agent_id must equal the super agent's ID
 * - referring_agent_id is PRESERVED after promotion (attribution + storefront access)
 * - parent_agent_id is set to the super agent so the sub-agent appears in their downline
 * - An agent_profiles row is created for the new sub-agent so they have their own storefront
 */
export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  try {
    const gate = await requireAgent();
    if (!gate.ok) return gate.response;

    // Use admin client to bypass RLS for all operations
    const admin = createAdminClient();
    const superAgentId = gate.user.id;

    // Verify caller is actually a Super Agent
    const { data: superAgentProfile } = await admin
      .from('profiles')
      .select('is_super_agent, full_name, username')
      .eq('id', superAgentId)
      .single();

    if (!superAgentProfile?.is_super_agent) {
      return NextResponse.json({ error: 'Only Super Agents can promote Sub-Agents' }, { status: 403 });
    }

    const body = await req.json();
    const { researcherId } = body;

    if (!researcherId) {
      return NextResponse.json({ error: 'Researcher ID is required' }, { status: 400 });
    }

    // Fetch the researcher's full profile
    const { data: researcherProfile } = await admin
      .from('profiles')
      .select('role, referring_agent_id, full_name, username, email')
      .eq('id', researcherId)
      .single();

    if (!researcherProfile) {
      return NextResponse.json({ error: 'Researcher not found' }, { status: 404 });
    }

    // Security: researcher MUST belong to this super agent
    if (researcherProfile.referring_agent_id !== superAgentId) {
      return NextResponse.json(
        { error: 'Researcher does not belong to your downline' },
        { status: 403 }
      );
    }

    if (['agent', 'super_agent', 'admin'].includes(researcherProfile.role)) {
      return NextResponse.json(
        { error: 'User is already an Agent, Super Agent, or Admin' },
        { status: 400 }
      );
    }

    // ── Step 1: Promote researcher → sub-agent ────────────────────────────────
    // IMPORTANT: referring_agent_id is PRESERVED. It keeps the attribution link
    // back to the super agent who created them. parent_agent_id marks the
    // organizational hierarchy. A sub-agent's storefront access still works
    // because isSubAgent = role==='agent' && parent_agent_id === agent.id.
    const { error: updateError } = await admin
      .from('profiles')
      .update({
        role: 'agent',
        parent_agent_id: superAgentId,
        // referring_agent_id intentionally NOT changed — preserved for attribution
        updated_at: new Date().toISOString(),
      })
      .eq('id', researcherId);

    if (updateError) {
      console.error('[promote-subagent] profiles update error:', updateError);
      return NextResponse.json({ error: 'Promotion failed. Please try again.' }, { status: 500 });
    }

    // ── Step 2: Create agent_profiles row for the new sub-agent ───────────────
    // Without this row the sub-agent cannot have their own storefront or products.
    // Use the researcher's username as their default slug (sanitized).
    const defaultSlug = (researcherProfile.username || researcherProfile.email?.split('@')[0] || researcherId.slice(0, 8))
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 50);

    const { error: agentProfileError } = await admin
      .from('agent_profiles')
      .upsert({
        id: researcherId,
        slug: defaultSlug,
        display_name: researcherProfile.full_name || defaultSlug,
        is_active: true,
      }, { onConflict: 'id' });

    if (agentProfileError) {
      console.error('[promote-subagent] agent_profiles upsert error:', agentProfileError);
      // Roll back the promotion so the DB stays consistent
      await admin.from('profiles').update({
        role: 'researcher',
        parent_agent_id: null,
        updated_at: new Date().toISOString(),
      }).eq('id', researcherId);
      return NextResponse.json(
        { error: 'Could not create agent storefront profile. Promotion rolled back.' },
        { status: 500 }
      );
    }

    // Fire-and-forget: notify both the new sub-agent AND the super-agent
    void Promise.all([
      notifyPromotedToAgent(admin, researcherId, defaultSlug, superAgentProfile.full_name || 'Your Super Agent'),
      notifyPromotionSuccess(admin, superAgentId, researcherProfile.full_name || 'Researcher', defaultSlug),
    ]).catch(() => { /* best-effort */ });

    return NextResponse.json({
      success: true,
      agentSlug: defaultSlug,
      message: `${researcherProfile.full_name || 'Researcher'} has been promoted to Sub-Agent. Their storefront slug is /${defaultSlug}.`,
    });

  } catch (error) {
    console.error('[promote-subagent] unexpected error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
