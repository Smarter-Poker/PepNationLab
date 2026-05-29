import { NextResponse, type NextRequest } from 'next/server';
import { createServiceClient, createClient } from '@/lib/supabase/server';
import { assertSameOrigin } from '@/lib/csrf';

/**
 * DELETE — revoke an invite. We do NOT delete the row (so the audit trail
 * stays intact); instead we set `redeemed_at = NOW()` with `metadata.revoked
 * = true`. The unique partial index `agent_invitations_token_idx WHERE
 * redeemed_at IS NULL` immediately stops the token from matching the redeem
 * path's lookup, and the redeem route additionally checks `metadata.revoked`
 * before any downstream effect.
 *
 * Admins can revoke any invite. Super agents can revoke only invites they
 * minted.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: 'Invalid Id' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const service = await createServiceClient();
  const { data: profile } = await service
    .from('profiles')
    .select('role, is_super_agent')
    .eq('id', user.id)
    .maybeSingle();

  const isAdmin = profile?.role === 'admin';
  const isSuperAgent = profile?.role === 'super_agent' || profile?.is_super_agent === true;
  if (!isAdmin && !isSuperAgent) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { data: invite, error: lookupErr } = await service
    .from('agent_invitations')
    .select('id, invited_by, redeemed_at, metadata, email')
    .eq('id', id)
    .maybeSingle();

  if (lookupErr || !invite) {
    return NextResponse.json({ error: 'Invite Not Found' }, { status: 404 });
  }

  if (!isAdmin && invite.invited_by !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  if (invite.redeemed_at) {
    return NextResponse.json({ error: 'Invite Already Used.' }, { status: 409 });
  }

  const nextMetadata = { ...(invite.metadata as Record<string, unknown> ?? {}), revoked: true };
  const { error: updateErr } = await service
    .from('agent_invitations')
    .update({ redeemed_at: new Date().toISOString(), metadata: nextMetadata })
    .eq('id', id);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  if (isAdmin) {
    await service.from('admin_audit_log').insert({
      actor_id: user.id,
      action: 'invite_revoked',
      entity_type: 'agent_invitation',
      entity_id: id,
      changes: { email: invite.email },
    });
  }

  return NextResponse.json({ success: true });
}
