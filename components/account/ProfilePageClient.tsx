'use client';

import { useState } from 'react';
import AccountOverview from './AccountOverview';
import type { AccountProfile } from './AccountClient';

interface Props {
  userId: string;
  userEmail: string;
  initialProfile: AccountProfile | null;
}

/**
 * Standalone Profile page client. Reuses the existing AccountOverview editor
 * (avatar, full name, phone, timezone, language, pronouns, bio, username) so the
 * dedicated /account/profile route shares one source of truth with the tabbed
 * /account/settings overview. Saves via PATCH /api/agent/profile.
 */
export default function ProfilePageClient({ userId, userEmail, initialProfile }: Props) {
  const [profile, setProfile] = useState<AccountProfile | null>(initialProfile);

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--black)', padding: 'var(--space-6) var(--space-4)' }}>
      <div className="container" style={{ maxWidth: 760 }}>
        <h1
          className="animated-gradient-text"
          style={{ color: 'var(--white)', fontSize: '1.6rem', fontFamily: 'var(--font-brand)', marginBottom: 'var(--space-2)' }}
        >
          Profile
        </h1>
        <p style={{ color: 'var(--silver)', fontSize: '0.92rem', marginBottom: 'var(--space-6)' }}>
          Manage Your Personal Information, Avatar, And Username.
        </p>

        <AccountOverview
          userId={userId}
          userEmail={userEmail}
          profile={profile}
          onProfileChange={setProfile}
        />
      </div>
    </div>
  );
}
