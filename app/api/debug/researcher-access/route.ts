import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/debug/researcher-access
 * Returns the current user's role, referring_agent_id, and the matching agent slug.
 * TEMPORARY DEBUG ENDPOINT - remove after diagnosing the storefront routing bug.
 */
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated', authError: authError?.message });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, referring_agent_id, full_name, email, must_change_password')
    .eq('id', user.id)
    .single();

  let agentProfile = null;
  if (profile?.referring_agent_id) {
    const { data: ap } = await supabase
      .from('agent_profiles')
      .select('id, slug, display_name, is_active')
      .eq('id', profile.referring_agent_id)
      .maybeSingle();
    agentProfile = ap;
  }

  const storeFrontUrl = agentProfile?.slug ? `/${agentProfile.slug}` : null;

  return NextResponse.json({
    userId: user.id,
    email: user.email,
    profile: {
      id: profile?.id,
      role: profile?.role,
      full_name: profile?.full_name,
      referring_agent_id: profile?.referring_agent_id,
      must_change_password: (profile as any)?.must_change_password,
    },
    agentProfile,
    storeFrontUrl,
    hasAccess: profile?.role === 'researcher' && profile?.referring_agent_id === agentProfile?.id,
    diagnosis: !user
      ? 'NO_SESSION'
      : profile?.role !== 'researcher'
      ? `WRONG_ROLE: ${profile?.role}`
      : !profile?.referring_agent_id
      ? 'NO_REFERRING_AGENT_ID - researcher was not created through an agent'
      : !agentProfile
      ? 'AGENT_PROFILE_NOT_FOUND - referring_agent_id does not match any agent_profiles.id'
      : !agentProfile.is_active
      ? 'AGENT_INACTIVE'
      : 'ACCESS_SHOULD_WORK',
  });
}
