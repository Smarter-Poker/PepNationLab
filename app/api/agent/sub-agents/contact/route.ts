import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { requireAgent } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';

export async function PATCH(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  try {
    const gate = await requireAgent();
    if (!gate.ok) return gate.response;

    const body = await req.json().catch(() => ({}));
    const { subAgentId, email, phone } = body;

    if (!subAgentId) {
      return NextResponse.json({ error: 'subAgentId is required' }, { status: 400 });
    }

    const admin = createAdminClient();

    // Verify the sub-agent belongs to the caller's downline
    const { data: profile } = await admin
      .from('profiles')
      .select('parent_agent_id')
      .eq('id', subAgentId)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Sub-Agent Not Found' }, { status: 404 });
    }

    if (profile.parent_agent_id !== gate.user.id) {
      return NextResponse.json({ error: 'This Sub-Agent Is Not In Your Network' }, { status: 403 });
    }

    const updates: { email?: string; phone?: string | null } = {};
    if (typeof email === 'string' && email.trim()) updates.email = email.trim();
    if (phone !== undefined) updates.phone = typeof phone === 'string' ? phone.trim() : null;

    if (Object.keys(updates).length > 0) {
      const { error } = await admin
        .from('profiles')
        .update(updates)
        .eq('id', subAgentId);

      if (error) throw error;

      // If email was updated, update auth user
      if (updates.email) {
        await admin.auth.admin.updateUserById(subAgentId, { email: updates.email });
      }
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[PATCH sub-agent-contact] error:', err);
    return NextResponse.json({ error: 'Failed to update contact info' }, { status: 500 });
  }
}
