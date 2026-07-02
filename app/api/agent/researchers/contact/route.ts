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
    const { researcherId, email, phone } = body;

    if (!researcherId) {
      return NextResponse.json({ error: 'researcherId is required' }, { status: 400 });
    }

    const admin = createAdminClient();

    // Verify the researcher belongs to the caller's downline
    const { data: profile } = await admin
      .from('profiles')
      .select('referring_agent_id')
      .eq('id', researcherId)
      .single();

    if (!profile) {
      return NextResponse.json({ error: 'Researcher Not Found' }, { status: 404 });
    }

    if (profile.referring_agent_id !== gate.user.id) {
      return NextResponse.json({ error: 'This Researcher Is Not In Your Network' }, { status: 403 });
    }

    const updates: { email?: string; phone?: string | null } = {};
    if (typeof email === 'string' && email.trim()) updates.email = email.trim().toLowerCase();
    if (phone !== undefined) updates.phone = typeof phone === 'string' ? phone.trim() : null;

    // Validate the email BEFORE touching anything. An invalid address must not
    // be written to profiles, otherwise profiles.email drifts away from the
    // auth identity and breaks username login (resolve returns an address that
    // no auth user owns).
    if (updates.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(updates.email)) {
      return NextResponse.json({ error: 'Please Enter A Valid Email Address' }, { status: 400 });
    }

    if (Object.keys(updates).length > 0) {
      // Update the AUTH identity FIRST. If this fails we abort before writing
      // profiles.email, so the two can never diverge (the divergence is what
      // silently broke login for accounts whose contact email was changed).
      if (updates.email) {
        const { error: authErr } = await admin.auth.admin.updateUserById(researcherId, {
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
        .eq('id', researcherId);

      if (error) throw error;
    }

    return NextResponse.json({ success: true });
  } catch (err: any) /* eslint-disable-line @typescript-eslint/no-explicit-any */ {
    console.error('[PATCH agent-researcher-contact] error:', err);
    return NextResponse.json({ error: 'Failed to update contact info' }, { status: 500 });
  }
}
