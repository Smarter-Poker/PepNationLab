'use client';

import { useCallback, useMemo, useState } from 'react';
import { toast } from 'sonner';
import AvatarUpload from '@/components/AvatarUpload';
import ProfileCompletenessRing from './ProfileCompletenessRing';
import UsernameChangeModal from './UsernameChangeModal';
import type { AccountProfile } from './AccountClient';

interface Props {
  userId: string;
  userEmail: string;
  profile: AccountProfile | null;
  agentProfile?: any;
  onProfileChange: (next: AccountProfile) => void;
}

const LOCALES: Array<{ value: string; label: string }> = [
  { value: 'en',    label: 'English' },
  { value: 'es',    label: 'Spanish' },
  { value: 'pt-BR', label: 'Portuguese (Brazil)' },
];

const COMMON_TIMEZONES: string[] = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Phoenix',
  'America/Los_Angeles',
  'America/Anchorage',
  'America/Honolulu',
  'America/Sao_Paulo',
  'Europe/London',
  'Europe/Madrid',
  'Asia/Tokyo',
  'Asia/Singapore',
  'Australia/Sydney',
  'UTC',
];

const REQUIRED_FIELDS: Array<keyof AccountProfile> = [
  'first_name',
  'last_name',
  'email',
  'phone',
  'timezone',
  'avatar_url',
];

function completenessPercent(p: AccountProfile | null, ap?: any): number {
  if (!p) return 0;
  
  let requiredCount = REQUIRED_FIELDS.length;
  let filled = REQUIRED_FIELDS.reduce((n, key) => {
    const v = p[key];
    if (typeof v === 'string' && v.trim().length > 0) return n + 1;
    if (v) return n + 1;
    return n;
  }, 0);

  if (ap) {
    requiredCount += 4; // slug, warehouse, payment, active
    const slugMissing = !ap.slug || /^agent(?:-|$)/i.test(ap.slug);
    if (!slugMissing) filled += 1;
    const warehouse = ap.warehouse_address;
    const warehouseEmpty = !warehouse || !warehouse.street1 || !warehouse.city || !warehouse.state || !warehouse.zip;
    if (!warehouseEmpty) filled += 1;
    const handles = ap.payment_handles;
    const handlesEmpty = !handles || Object.keys(handles).every((k) => !handles[k]);
    if (!handlesEmpty) filled += 1;
    if (ap.is_active) filled += 1;
  }

  return Math.round((filled / requiredCount) * 100);
}

export default function AccountOverview({ userEmail, profile, agentProfile, onProfileChange }: Props) {
  const [draft, setDraft] = useState({
    first_name: profile?.first_name ?? '',
    last_name:  profile?.last_name ?? '',
    email:      profile?.email?.includes('@internal.auth') || profile?.email?.includes('@pepnationlab.com') ? '' : (profile?.email ?? ''),
    phone:      profile?.phone ?? '',
    timezone:   profile?.timezone ?? 'America/New_York',
  });
  const [saving, setSaving] = useState(false);
  const [usernameModalOpen, setUsernameModalOpen] = useState(false);

  const completeness = useMemo(() => completenessPercent(profile, agentProfile), [profile, agentProfile]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const body: Record<string, unknown> = {};
      const map: Array<[keyof typeof draft, keyof AccountProfile]> = [
        ['first_name', 'first_name'],
        ['last_name',  'last_name'],
        ['email',      'email'],
        ['phone',      'phone'],
        ['timezone',   'timezone'],
      ];
      for (const [d, p] of map) {
        const next = draft[d].trim();
        const current = (profile?.[p] ?? '') as string | null;
        const currentTrim = (current ?? '').trim();
        if (next !== currentTrim) {
          body[d] = next.length === 0 ? null : next;
        }
      }
      if (Object.keys(body).length === 0) {
        toast.info('No Changes To Save.');
        return;
      }

      const res = await fetch('/api/agent/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed To Save Profile.');
      }
      toast.success('Profile Updated.');
      if (json.profile && profile) {
        onProfileChange({ ...profile, ...json.profile });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed To Save Profile.';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }, [draft, profile, onProfileChange]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-6)' }}>
      <div
        className="card-metal"
        style={{
          padding: 'var(--space-6)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-5)',
          flexWrap: 'wrap',
        }}
      >
        <AvatarUpload
          currentAvatarUrl={profile?.avatar_url ?? null}
          name={profile?.full_name ?? profile?.username ?? 'User'}
          onUploadSuccess={(url) => {
            if (profile) onProfileChange({ ...profile, avatar_url: url });
          }}
        />

        <div style={{ flex: '1 1 200px', minWidth: 200 }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--silver)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Username
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              marginTop: 4,
              flexWrap: 'wrap',
            }}
          >
            <span style={{ fontFamily: 'monospace', color: 'var(--teal)', fontSize: '1rem' }}>
              {profile?.username ?? 'Not Set'}
            </span>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setUsernameModalOpen(true)}
            >
              Edit
            </button>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--silver)', marginTop: 'var(--space-3)' }}>Email</div>
          <div style={{ color: 'var(--white)', fontSize: '0.9rem', marginTop: 2 }}>{userEmail || '—'}</div>
        </div>

        <ProfileCompletenessRing percent={completeness} />
      </div>

      <div className="card-metal" style={{ padding: 'var(--space-6)' }}>
        <h3 style={{ marginTop: 0, marginBottom: 'var(--space-4)', color: 'var(--teal)' }}>Profile Details</h3>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: 'var(--space-4)',
          }}
        >
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" htmlFor="first-name">First Name</label>
            <input
              id="first-name"
              type="text"
              className="form-input"
              value={draft.first_name}
              onChange={(e) => setDraft((d) => ({ ...d, first_name: e.target.value }))}
              maxLength={60}
              autoComplete="given-name"
            />
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" htmlFor="last-name">Last Name</label>
            <input
              id="last-name"
              type="text"
              className="form-input"
              value={draft.last_name}
              onChange={(e) => setDraft((d) => ({ ...d, last_name: e.target.value }))}
              maxLength={60}
              autoComplete="family-name"
            />
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" htmlFor="phone">Phone Number</label>
            <input
              id="phone"
              type="tel"
              className="form-input"
              value={draft.phone}
              onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))}
              placeholder=""
              maxLength={40}
              autoComplete="tel"
              inputMode="tel"
            />
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" htmlFor="email">Email Address</label>
            <input
              id="email"
              type="email"
              className="form-input"
              value={draft.email}
              onChange={(e) => setDraft((d) => ({ ...d, email: e.target.value }))}
              placeholder="Your Real Email"
              maxLength={120}
              autoComplete="email"
            />
          </div>

          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label" htmlFor="timezone">Timezone</label>
            <select
              id="timezone"
              className="form-input"
              value={draft.timezone}
              onChange={(e) => setDraft((d) => ({ ...d, timezone: e.target.value }))}
            >
              <option value="" disabled>Select Timezone</option>
              {COMMON_TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ marginTop: 'var(--space-5)', display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-primary" disabled={saving} onClick={handleSave}>
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      <UsernameChangeModal
        open={usernameModalOpen}
        currentUsername={profile?.username ?? null}
        usernameChangedAt={profile?.username_changed_at ?? null}
        onClose={() => setUsernameModalOpen(false)}
        onChanged={(next) => {
          if (profile) onProfileChange({ ...profile, ...next });
        }}
      />
    </div>
  );
}
