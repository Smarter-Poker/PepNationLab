import { NextResponse, type NextRequest } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';

export async function PATCH(request: NextRequest) {
  try {
    const csrf = assertSameOrigin(request);
    if (csrf) return csrf;

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const serviceSupabase = await createServiceClient();

    // Get caller's role and ID to verify permissions
    const { data: callerProfile } = await serviceSupabase
      .from('profiles')
      .select('role, id, is_super_agent, is_sub_agent')
      .eq('id', user.id)
      .single();

    if (!callerProfile) {
      return NextResponse.json({ error: 'Caller profile not found' }, { status: 404 });
    }

    // SACA: sub-agents cannot toggle trust on anyone (or on themselves). The
    // existing canModify branches happen to fail safe for sub-agents (their
    // tagged researchers point referring_agent_id at the parent, not them),
    // but we reject explicitly so the audit log shows a deliberate refusal
    // instead of silently passing through to a 403 "you don't have permission".
    if ((callerProfile as { is_sub_agent?: boolean | null }).is_sub_agent === true) {
      return NextResponse.json(
        { error: 'Sub-Agents Cannot Modify Trust Settings. Ask Your Agent.' },
        { status: 403 }
      );
    }

    const { targetUserId, auto_approve_orders } = await request.json();

    if (!targetUserId || typeof auto_approve_orders !== 'boolean') {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    // 1. Fetch the target user's profile
    const { data: targetProfile } = await serviceSupabase
      .from('profiles')
      .select('id, role, parent_agent_id, referring_agent_id')
      .eq('id', targetUserId)
      .single();

    if (!targetProfile) {
      return NextResponse.json({ error: 'Target user not found' }, { status: 404 });
    }

    // 2. Security Check: Can this caller modify this target?
    let canModify = false;

    if (callerProfile.role === 'admin') {
      // Admins can toggle anyone (usually Super Agents)
      canModify = true;
    } else if (callerProfile.role === 'agent' && callerProfile.is_super_agent) {
      // Super Agents can toggle their direct Sub-Agents and their direct Researchers
      if (
        (targetProfile.role === 'agent' && targetProfile.parent_agent_id === callerProfile.id) ||
        (targetProfile.role === 'researcher' && targetProfile.referring_agent_id === callerProfile.id)
      ) {
        canModify = true;
      }
    } else if (callerProfile.role === 'agent' && !callerProfile.is_super_agent) {
      // Sub-Agents can toggle their direct Researchers
      if (targetProfile.role === 'researcher' && targetProfile.referring_agent_id === callerProfile.id) {
        canModify = true;
      }
    }

    if (!canModify) {
      return NextResponse.json({ error: 'Forbidden: You do not have permission to modify this user.' }, { status: 403 });
    }

    // 3. Update the trust flag
    const { error: updateError } = await serviceSupabase
      .from('profiles')
      .update({ auto_approve_orders })
      .eq('id', targetUserId);

    if (updateError) {
      console.error('Failed to update trust flag:', updateError);
      return NextResponse.json({ error: 'Database update failed' }, { status: 500 });
    }

    return NextResponse.json({ success: true, auto_approve_orders });
  } catch (err: any) /* eslint-disable-line @typescript-eslint/no-explicit-any */ {
    console.error('Trust Toggle Error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
