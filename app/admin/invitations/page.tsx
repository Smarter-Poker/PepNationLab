import type { Metadata } from 'next';
import InvitationsClient from './InvitationsClient';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Invitations | Admin | Pep Nation Lab',
};

export default function AdminInvitationsPage() {
  return (
    <div style={{ padding: 'var(--space-8)' }}>
      <div style={{ marginBottom: 'var(--space-6)' }}>
        <h1 style={{ fontSize: '1.6rem', marginBottom: 'var(--space-2)' }}>
          Agent <span style={{ color: 'var(--teal)' }}>Invitations</span>
        </h1>
        <p style={{ fontSize: '0.88rem', color: 'var(--grey-400)' }}>
          Mint One-Time Onboarding Links For New Agents And Super Agents.
        </p>
      </div>
      <InvitationsClient mode="admin" />
    </div>
  );
}
