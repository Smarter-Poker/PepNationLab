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
    if (typeof email === 'string' && email.trim()) updates.email = email.trim().toLowerCase();
    if (phone !== undefined) updates.phone = typeof phone === 'string' ? phone.trim() : null;

    // Validate before writing so profiles.email cannot drift away from the
    // auth login identity (a divergence silently breaks username login).
    if (updates.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(updates.email)) {
      return NextResponse.json({ error: 'Please Enter A Valid Email Address' }, { status: 400 });
    }

    if (Object.keys(updates).length > 0) {
      // Update the AUTH identity FIRST; abort before the profile write if it
      // fails, so the two can never diverge.
      if (updates.email) {
        const { error: authErr } = await admin.auth.admin.updateUserById(subAgentId, {
          email: updates.email,
          email_confirm: true,
        });
        if (authErr) {
          return NextResponse.json({ error: 'Could Not Update Login Email. Please Check The Address And Try Again.' }, { status: 400 });
        }
      }

      const { error } = await admin
        .from('profiles')
        .update(updates)
        .eq('id', subAgentId);

      if (error) throw error;
    }

    return NextResponse.json({ success: true });
  } catch (err: any) /* eslint-disable-line @typescript-eslint/no-explicit-any */ {
    console.error('[PATCH sub-agent-contact] error:', err);
    return NextResponse.json({ error: 'Failed to update contact info' }, { status: 500 });
  }
}
