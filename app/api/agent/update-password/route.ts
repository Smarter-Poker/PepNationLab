import { NextRequest, NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

/**
 * Agents can reset passwords for their own researchers and sub-agents.
 * Validates that the target user's referring_agent_id matches the caller.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Verify caller is an agent
  const serviceSupabase = await createServiceClient();
  const { data: callerProfile } = await serviceSupabase
    .from('profiles')
    .select('id, role')
    .eq('id', user.id)
    .single();

  if (!callerProfile || !['agent', 'super_agent', 'admin'].includes(callerProfile.role)) {
    return NextResponse.json({ error: 'Only Agents Can Reset User Passwords' }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const { userId, newPassword } = body;

  if (!userId || !newPassword) {
    return NextResponse.json({ error: 'Missing Required Fields' }, { status: 400 });
  }
  if (newPassword.length < 8) {
    return NextResponse.json({ error: 'Password Must Be At Least 8 Characters' }, { status: 400 });
  }

  // Verify the target user belongs to this agent (referring_agent_id = caller)
  const { data: targetProfile } = await serviceSupabase
    .from('profiles')
    .select('id, referring_agent_id, role')
    .eq('id', userId)
    .single();

  if (!targetProfile) {
    return NextResponse.json({ error: 'User Not Found' }, { status: 404 });
  }

  // Agent can only reset passwords for users referred by them
  if (targetProfile.referring_agent_id !== user.id) {
    return NextResponse.json({ error: 'You Can Only Reset Passwords For Your Own Researchers And Sub-Agents' }, { status: 403 });
  }

  const { error } = await serviceSupabase.auth.admin.updateUserById(userId, { password: newPassword });
  if (error) {
    return NextResponse.json({ error: `Failed To Update Password: ${error.message}` }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
