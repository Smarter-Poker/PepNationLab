export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { requireAgent } from '@/lib/admin-auth';
import { assertSameOrigin } from '@/lib/csrf';

// DELETE /api/agent/invitations/[id] -- revoke a pending invitation.
//
// Revoking marks redeemed_at = NOW() with metadata.revoked = true (the pattern
// the migration documents), so the unique partial index frees the email and the
// token can no longer be redeemed. Super agents may only revoke their own.
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const originError = assertSameOrigin(req);
  if (originError) return originError;

  const gate = await requireAgent();
  if (!gate.ok) return gate.response;

  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'Missing Invitation Id.' }, { status: 400 });

  const supabase = createAdminClient();

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, is_super_agent')
    .eq('id', gate.user.id)
    .maybeSingle();

  const isAdmin = profile?.role === 'admin';
  const isSuperAgent = profile?.role === 'super_agent' || profile?.is_super_agent === true;
  if (!isAdmin && !isSuperAgent) {
    return NextResponse.json({ error: 'Not Permitted.' }, { status: 403 });
  }

  const { data: invite } = await supabase
    .from('agent_invitations')
    .select('id, invited_by, redeemed_at, metadata')
    .eq('id', id)
    .maybeSingle();

  if (!invite) {
    return NextResponse.json({ error: 'Invitation Not Found.' }, { status: 404 });
  }
  // Ownership check (admins bypass), mirroring the RLS scope.
  if (!isAdmin && invite.invited_by !== gate.user.id) {
    return NextResponse.json({ error: 'Not Permitted.' }, { status: 403 });
  }
  if (invite.redeemed_at) {
    return NextResponse.json({ error: 'This Invitation Was Already Redeemed Or Revoked.' }, { status: 409 });
  }

  const { error } = await supabase
    .from('agent_invitations')
    .update({
      redeemed_at: new Date().toISOString(),
      metadata: { ...(invite.metadata ?? {}), revoked: true, revoked_by: gate.user.id },
    })
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: 'Could Not Revoke The Invitation.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
