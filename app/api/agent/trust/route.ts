import { NextResponse } from 'next/server';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export async function PATCH(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const serviceSupabase = await createServiceClient();

    // Get caller's role and ID to verify permissions
    const { data: callerProfile } = await serviceSupabase
      .from('profiles')
      .select('role, id')
      .eq('id', user.id)
      .single();

    if (!callerProfile) {
      return NextResponse.json({ error: 'Caller profile not found' }, { status: 404 });
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
    } else if (callerProfile.role === 'super_agent') {
      // Super Agents can toggle their direct Sub-Agents and their direct Researchers
      if (
        (targetProfile.role === 'agent' && targetProfile.parent_agent_id === callerProfile.id) ||
        (targetProfile.role === 'researcher' && targetProfile.referring_agent_id === callerProfile.id)
      ) {
        canModify = true;
      }
    } else if (callerProfile.role === 'agent') {
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
  } catch (err: any) {
    console.error('Trust Toggle Error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
