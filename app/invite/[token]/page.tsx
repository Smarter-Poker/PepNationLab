import type { Metadata } from 'next';
import Link from 'next/link';
import { createServiceClient } from '@/lib/supabase/server';
import InviteRedeemClient from './InviteRedeemClient';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Accept Invitation | Pep Nation Lab',
  robots: { index: false, follow: false },
};

const ROLE_LABELS: Record<string, string> = {
  agent: 'Agent',
  super_agent: 'Super Agent',
};

const TIER_LABELS: Record<string, string> = {
  tier_1: 'Tier 1',
  tier_2: 'Tier 2',
  tier_3: 'Tier 3',
};

export default async function InviteRedeemPage(
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const service = await createServiceClient();
  const { data: invite } = await service
    .from('agent_invitations')
    .select('email, full_name, intended_role, intended_tier, expires_at, redeemed_at, metadata')
    .eq('token', token)
    .maybeSingle();

  const isInvalid = (() => {
    if (!invite) return true;
    if (invite.redeemed_at) return true;
    if ((invite.metadata as { revoked?: boolean } | null)?.revoked === true) return true;
    if (new Date(invite.expires_at).getTime() < Date.now()) return true;
    return false;
  })();

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--black)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-6)',
      }}
    >
      <div className="card-metal" style={{ padding: 'var(--space-8)', maxWidth: 480, width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-6)' }}>
          <div
            style={{
              fontFamily: 'var(--font-brand)',
              fontSize: '0.92rem',
              fontWeight: 800,
              letterSpacing: '0.12em',
              color: 'var(--teal)',
              textShadow: '0 0 12px rgba(0,196,188,0.3)',
              marginBottom: 'var(--space-2)',
            }}
          >
            PEP NATION LAB
          </div>
          <h1 style={{ fontSize: '1.4rem', color: 'var(--white)', marginBottom: 'var(--space-2)' }}>
            {isInvalid ? 'Invite Link Is Invalid Or Has Expired' : 'Accept Your Invitation'}
          </h1>
          {!isInvalid && invite && (
            <p style={{ fontSize: '0.88rem', color: 'var(--grey-400)' }}>
              You Have Been Invited To Join As An{' '}
              <span style={{ color: 'var(--teal)', fontWeight: 600 }}>
                {ROLE_LABELS[invite.intended_role] ?? 'Agent'}
              </span>
              {invite.intended_tier ? (
                <>
                  {' '}({TIER_LABELS[invite.intended_tier] ?? invite.intended_tier})
                </>
              ) : null}
              .
            </p>
          )}
        </div>

        {isInvalid ? (
          <>
            <p style={{ fontSize: '0.86rem', color: 'var(--grey-400)', textAlign: 'center', marginBottom: 'var(--space-6)' }}>
              This Invitation Cannot Be Accepted. It May Have Already Been Used, Been Revoked, Or Expired. Please Contact The Person Who Sent It For A New Link.
            </p>
            <div style={{ textAlign: 'center' }}>
              <Link href="/login" className="btn btn-primary" style={{ fontSize: '0.85rem' }}>
                Return To Login
              </Link>
            </div>
          </>
        ) : (
          invite && (
            <InviteRedeemClient
              token={token}
              email={invite.email}
              suggestedFullName={invite.full_name || ''}
              intendedRole={invite.intended_role}
            />
          )
        )}
      </div>
    </div>
  );
}
