import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { requireAgent } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';

/**
 * Agents can reset passwords for their own researchers and sub-agents.
 * Validates that the target user's referring_agent_id matches the caller.
 */
export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const gate = await requireAgent();
  if (!gate.ok) return gate.response;

  const serviceSupabase = createAdminClient();

  // Verify caller is an agent/super-agent/admin (requireAgent already checks agent/super_agent)
  // so we only need to also allow admin role
  const { data: callerProfile } = await serviceSupabase
    .from('profiles')
    .select('id, role')
    .eq('id', gate.user.id)
    .single();

  if (!callerProfile || !['agent', 'super_agent', 'admin'].includes(callerProfile.role)) {
    return NextResponse.json({ error: 'Only Agents Can Reset User Passwords' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { userId, newPassword } = body;

  if (!userId || !newPassword) {
    return NextResponse.json({ error: 'Missing Required Fields' }, { status: 400 });
  }
  if (typeof newPassword !== 'string' || newPassword.length < 8) {
    return NextResponse.json({ error: 'Password Must Be At Least 8 Characters' }, { status: 400 });
  }

  // Verify the target user belongs to this agent (referring_agent_id = caller)
  const { data: targetProfile } = await serviceSupabase
    .from('profiles')
    .select('id, referring_agent_id, role')
    .eq('id', userId)
    .single();

  // Guard: target must be a researcher or sub-agent - NEVER an admin or another agent
  // at a different branch. The referring_agent_id check enforces ownership.
  if (!targetProfile || !['researcher', 'agent'].includes(targetProfile.role)) {
    return NextResponse.json({ error: 'User Not Found' }, { status: 404 });
  }

  // Agent can only reset passwords for users referred by them
  if (targetProfile.referring_agent_id !== gate.user.id) {
    return NextResponse.json({ error: 'You Can Only Reset Passwords For Your Own Researchers And Sub-Agents' }, { status: 403 });
  }

  const { error } = await serviceSupabase.auth.admin.updateUserById(userId, { password: newPassword });
  if (error) {
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 });
  }

  // Set must_change_password to true so they are forced to change it on their next login
  const { error: profileErr } = await serviceSupabase
    .from('profiles')
    .update({ must_change_password: true, updated_at: new Date().toISOString() })
    .eq('id', userId);

  if (profileErr) {
    console.error('Failed to set must_change_password flag:', profileErr);
  }

  return NextResponse.json({ success: true });
}
