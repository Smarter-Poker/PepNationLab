'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import AccountOverview from './AccountOverview';
import SecurityTab from './SecurityTab';
import NotificationsTab from './NotificationsTab';
import ComplianceTab from './ComplianceTab';
import DangerZoneTab from './DangerZoneTab';

export interface AccountProfile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  email: string | null;
  username: string | null;
  role: string | null;
  phone: string | null;
  timezone: string | null;
  avatar_url: string | null;
  username_changed_at: string | null;
  phone_verified_at: string | null;
  deactivated_at: string | null;
  is_active: boolean | null;
  disclaimer_v1_accepted: boolean | null;
  disclaimer_accepted_at: string | null;
}

interface Props {
  userId: string;
  userEmail: string;
  initialProfile: AccountProfile | null;
  initialAgentProfile?: any;
  basePath?: string;
}

const TABS = [
  { id: 'overview',      label: 'Overview' },
  { id: 'security',      label: 'Security' },
  { id: 'notifications', label: 'Notifications' },
  { id: 'compliance',    label: 'Compliance' },
  { id: 'danger',        label: 'Danger Zone' },
] as const;

type TabId = (typeof TABS)[number]['id'];

function isTabId(s: string | null): s is TabId {
  return !!s && TABS.some((t) => t.id === s);
}

export default function AccountClient({
  userId,
  userEmail,
  initialProfile,
  initialAgentProfile,
  basePath = '/account/settings',
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams?.get('tab') ?? null;

  const [activeTab, setActiveTab] = useState<TabId>(
    isTabId(tabParam) ? tabParam : 'overview',
  );
  const [profile, setProfile] = useState<AccountProfile | null>(initialProfile);

  const goToTab = useCallback(
    (id: TabId) => {
      setActiveTab(id);
      const sp = new URLSearchParams(searchParams?.toString() ?? '');
      sp.set('tab', id);
      router.replace(`${basePath}?${sp.toString()}`, { scroll: false });
    },
    [router, searchParams, basePath],
  );

  useEffect(() => {
    if (isTabId(tabParam) && tabParam !== activeTab) {
      setActiveTab(tabParam);
    }
  }, [tabParam, activeTab]);

  const headerTitle = useMemo(() => {
    const name = profile?.full_name?.trim() || profile?.username?.trim();
    return name ? `Account: ${name}` : 'Your Account';
  }, [profile]);

  return (
    <div className="account-shell" style={{ minHeight: '100dvh', background: 'var(--black)', padding: 'var(--space-6) var(--space-4)' }}>
      <div className="container" style={{ maxWidth: 1080 }}>
        <header style={{ marginBottom: 'var(--space-6)' }}>
          <h1
            className="animated-gradient-text"
            style={{
              color: 'var(--white)',
              fontSize: '1.6rem',
              fontFamily: 'var(--font-brand)',
              marginBottom: 'var(--space-2)',
            }}
          >
            {headerTitle}
          </h1>
          <p style={{ color: 'var(--silver)', fontSize: '0.92rem', margin: 0 }}>
            Manage Your Profile, Sign-In Security, Notifications, And Compliance Status.
          </p>
        </header>

        <nav
          role="tablist"
          aria-label="Account Sections"
          className="account-tablist"
          style={{
            display: 'flex',
            gap: 'var(--space-2)',
            overflowX: 'auto',
            paddingBottom: 'var(--space-3)',
            marginBottom: 'var(--space-5)',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          {TABS.map((t) => {
            const active = t.id === activeTab;
            return (
              <button
                key={t.id}
                role="tab"
                aria-selected={active}
                onClick={() => goToTab(t.id)}
                style={{
                  appearance: 'none',
                  background: active ? 'rgba(192,184,168,0.12)' : 'transparent',
                  color: active ? 'var(--teal)' : 'var(--silver)',
                  border: '1px solid',
                  borderColor: active ? 'rgba(192,184,168,0.3)' : 'rgba(255,255,255,0.08)',
                  borderRadius: 999,
                  padding: '8px 14px',
                  fontSize: '0.88rem',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                }}
              >
                {t.label}
              </button>
            );
          })}
        </nav>

        <section
          role="tabpanel"
          aria-label={TABS.find((t) => t.id === activeTab)?.label}
          style={{ animation: 'fadeInUp 0.3s ease' }}
        >
          {activeTab === 'overview' && (
            <AccountOverview
              userId={userId}
              userEmail={userEmail}
              profile={profile}
              agentProfile={initialAgentProfile}
              onProfileChange={setProfile}
            />
          )}
          {activeTab === 'security' && (
            <SecurityTab userId={userId} userEmail={userEmail} />
          )}
          {activeTab === 'notifications' && <NotificationsTab />}
          {activeTab === 'compliance' && (
            <ComplianceTab
              disclaimerAccepted={!!profile?.disclaimer_v1_accepted}
              disclaimerAcceptedAt={profile?.disclaimer_accepted_at ?? null}
            />
          )}
          {activeTab === 'danger' && <DangerZoneTab />}
        </section>
      </div>
    </div>
  );
}
