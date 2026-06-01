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
  'full_name',
  'phone',
  'timezone',
  'locale',
  'bio',
  'pronouns',
  'avatar_url',
];

function completenessPercent(p: AccountProfile | null): number {
  if (!p) return 0;
  const filled = REQUIRED_FIELDS.reduce((n, key) => {
    const v = p[key];
    if (typeof v === 'string' && v.trim().length > 0) return n + 1;
    if (v) return n + 1;
    return n;
  }, 0);
  return Math.round((filled / REQUIRED_FIELDS.length) * 100);
}

export default function AccountOverview({ userEmail, profile, onProfileChange }: Props) {
  const [draft, setDraft] = useState({
    full_name: profile?.full_name ?? '',
    phone:     profile?.phone ?? '',
    timezone:  profile?.timezone ?? 'America/New_York',
    locale:    profile?.locale ?? 'en',
    bio:       profile?.bio ?? '',
    pronouns:  profile?.pronouns ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [usernameModalOpen, setUsernameModalOpen] = useState(false);

  const completeness = useMemo(() => completenessPercent(profile), [profile]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const body: Record<string, unknown> = {};
      const map: Array<[keyof typeof draft, keyof AccountProfile]> = [
        ['full_name', 'full_name'],
        ['phone',     'phone'],
        ['timezone',  'timezone'],
        ['locale',    'locale'],
        ['bio',       'bio'],
        ['pronouns',  'pronouns'],
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
          <div className="form-group">
            <label className="form-label" htmlFor="full-name">Full Name</label>
            <input
              id="full-name"
              type="text"
              className="form-input"
              value={draft.full_name}
              onChange={(e) => setDraft((d) => ({ ...d, full_name: e.target.value }))}
              maxLength={120}
              autoComplete="name"
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="phone">Phone</label>
            <input
              id="phone"
              type="tel"
              className="form-input"
              value={draft.phone}
              onChange={(e) => setDraft((d) => ({ ...d, phone: e.target.value }))}
              placeholder="+1 555 555 5555"
              maxLength={40}
              autoComplete="tel"
              inputMode="tel"
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="timezone">Timezone</label>
            <input
              id="timezone"
              type="text"
              className="form-input"
              list="account-tz-list"
              value={draft.timezone}
              onChange={(e) => setDraft((d) => ({ ...d, timezone: e.target.value }))}
              maxLength={60}
              autoComplete="off"
              spellCheck={false}
            />
            <datalist id="account-tz-list">
              {COMMON_TIMEZONES.map((tz) => (
                <option key={tz} value={tz} />
              ))}
            </datalist>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="locale">Language</label>
            <select
              id="locale"
              className="form-input"
              value={draft.locale}
              onChange={(e) => setDraft((d) => ({ ...d, locale: e.target.value }))}
            >
              {LOCALES.map((l) => (
                <option key={l.value} value={l.value}>{l.label}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="pronouns">Pronouns</label>
            <input
              id="pronouns"
              type="text"
              className="form-input"
              value={draft.pronouns}
              onChange={(e) => setDraft((d) => ({ ...d, pronouns: e.target.value }))}
              placeholder="e.g. She/Her"
              maxLength={40}
              autoComplete="off"
            />
          </div>

          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label" htmlFor="bio">Bio</label>
            <textarea
              id="bio"
              className="form-input"
              rows={3}
              value={draft.bio}
              onChange={(e) => setDraft((d) => ({ ...d, bio: e.target.value }))}
              maxLength={600}
              placeholder="A Short Note Other Researchers Will See."
            />
            <div style={{ marginTop: 4, textAlign: 'right', fontSize: '0.7rem', color: 'var(--silver)' }}>
              {draft.bio.length}/600
            </div>
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
