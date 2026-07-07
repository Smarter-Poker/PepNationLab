'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import AvatarUpload from '@/components/AvatarUpload';
import ProfileCompletenessRing from './ProfileCompletenessRing';
import UsernameChangeModal from './UsernameChangeModal';
import type { AccountProfile } from './AccountClient';
import { User, Mail, Phone, Clock, Image as ImageIcon, AtSign, AlertCircle } from 'lucide-react';

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

// Renders the leading icon for a missing-profile task row. Previously this
// helper was referenced in the "Complete Your Profile" modal but never
// defined, throwing a ReferenceError that crashed the modal for any user with
// an incomplete profile.
function getIcon(id: string) {
  const common = { size: 18, 'aria-hidden': true as const, style: { color: 'var(--silver)', flexShrink: 0 } };
  switch (id) {
    case 'first-name':
    case 'last-name':
      return <User {...common} />;
    case 'email':
    case 'email-verified':
      return <Mail {...common} />;
    case 'phone':
      return <Phone {...common} />;
    case 'timezone':
      return <Clock {...common} />;
    case 'avatar':
      return <ImageIcon {...common} />;
    case 'username':
      return <AtSign {...common} />;
    default:
      return <AlertCircle {...common} />;
  }
}

function getCompletenessData(p: AccountProfile | null, ap?: any) {
  if (!p) return { percent: 0, missingTasks: [] };
  
  const missingTasks: Array<{ id: string; label: string; actionText: string; target: string }> = [];

  const check = (condition: boolean, id: string, label: string, actionText: string, target: string) => {
    if (!condition) missingTasks.push({ id, label, actionText, target });
    return condition ? 1 : 0;
  };

  let requiredCount = REQUIRED_FIELDS.length;
  let filled = 0;

  filled += check(!!p.first_name?.trim(), 'first-name', 'First Name', 'Add Now', 'focus:first-name');
  filled += check(!!p.last_name?.trim(), 'last-name', 'Last Name', 'Add Now', 'focus:last-name');
  filled += check(!!p.contact_email?.trim() && p.email_verified === true, 'email-verified', 'Verified Email', 'Verify Now', 'inline:email-verified');
  filled += check(!!p.phone?.trim(), 'phone', 'Phone Number', 'Add Now', 'focus:phone');
  filled += check(!!p.timezone?.trim(), 'timezone', 'Timezone', 'Select Now', 'focus:timezone');
  filled += check(!!p.avatar_url, 'avatar', 'Profile Picture', 'Upload', 'focus:avatar');

  if (ap) {
    requiredCount += 4; // slug, warehouse, payment, active
    filled += check(!!ap.slug && !/^agent(?:-|$)/i.test(ap.slug), 'username', 'Custom Username', 'Edit Now', 'modal:username');
    
    const warehouse = ap.warehouse_address;
    filled += check(!!(warehouse && warehouse.street1 && warehouse.city && warehouse.state && warehouse.zip), 'warehouse', 'Warehouse Address', 'Add Now', 'inline:warehouse');
    
    const handles = ap.payment_handles;
    filled += check(!!(handles && Object.keys(handles).some((k: string) => handles[k])), 'payment', 'Payment Methods', 'Go to Agent Settings', 'nav:/dashboard/agent');
    
    filled += check(!!ap.is_active, 'active', 'Agent Status', 'Go to Agent Settings', 'nav:/dashboard/agent');
  }

  return {
    percent: Math.round((filled / requiredCount) * 100),
    missingTasks
  };
}

export default function AccountOverview({ userEmail, profile, agentProfile, onProfileChange }: Props) {
  // Local copy of agentProfile so warehouse saves update completeness immediately
  const [localAgentProfile, setLocalAgentProfile] = useState<any>(agentProfile);
  const [draft, setDraft] = useState({
    first_name: profile?.first_name ?? '',
    last_name:  profile?.last_name ?? '',
    email:      profile?.email?.includes('@internal.auth') || profile?.email?.includes('@pepnationlab.com') ? '' : (profile?.email ?? ''),
    phone:      profile?.phone ?? '',
    timezone:   profile?.timezone ?? 'America/New_York',
  });
  const [saving, setSaving] = useState(false);
  const [usernameModalOpen, setUsernameModalOpen] = useState(false);
  const [missingTasksModalOpen, setMissingTasksModalOpen] = useState(false);
  const router = useRouter();

  const { percent: completeness, missingTasks } = useMemo(() => getCompletenessData(profile, localAgentProfile), [profile, localAgentProfile]);

  const prevPercentRef = useRef(completeness);
  useEffect(() => {
    if (completeness === 100 && prevPercentRef.current !== 100) {
      toast.success("Profile Is 100% Complete!", { duration: 2000 });
      if (missingTasksModalOpen) {
        setTimeout(() => setMissingTasksModalOpen(false), 2000);
      }
    }
    prevPercentRef.current = completeness;
  }, [completeness, missingTasksModalOpen]);

  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [savingTask, setSavingTask] = useState(false);

  // Email verification inline state
  const [emailVerifyStep, setEmailVerifyStep] = useState<'email' | 'code'>('email');
  const [emailVerifyCode, setEmailVerifyCode] = useState('');
  const [emailVerifyError, setEmailVerifyError] = useState<string | null>(null);

  const handleSendEmailVerification = async () => {
    if (!inputValue.trim() || !inputValue.includes('@')) {
      setEmailVerifyError('Please enter a valid email.');
      return;
    }
    setSavingTask(true);
    setEmailVerifyError(null);
    try {
      const res = await fetch('/api/auth/request-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inputValue.trim(), purpose: 'verify_email' })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send code.');
      
      setEmailVerifyStep('code');
      toast.success('Verification code sent.');
    } catch (err: any) {
      setEmailVerifyError(err.message);
    } finally {
      setSavingTask(false);
    }
  };

  const handleVerifyEmailCode = async () => {
    if (emailVerifyCode.length !== 6) {
      setEmailVerifyError('Please enter a 6-digit code.');
      return;
    }
    setSavingTask(true);
    setEmailVerifyError(null);
    try {
      const res = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inputValue.trim(), code: emailVerifyCode })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to verify code.');
      
      toast.success('Email verified successfully.');
      if (profile) {
        onProfileChange({ ...profile, contact_email: inputValue.trim(), email_verified: true });
      }
      setExpandedTask(null);
      setEmailVerifyStep('email');
      setEmailVerifyCode('');
    } catch (err: any) {
      setEmailVerifyError(err.message);
    } finally {
      setSavingTask(false);
    }
  };

  // Inline warehouse address form state
  const [warehouseDraft, setWarehouseDraft] = useState({
    street1: (agentProfile?.warehouse_address?.street1 ?? '') as string,
    street2: (agentProfile?.warehouse_address?.street2 ?? '') as string,
    city:    (agentProfile?.warehouse_address?.city    ?? '') as string,
    state:   (agentProfile?.warehouse_address?.state   ?? '') as string,
    zip:     (agentProfile?.warehouse_address?.zip     ?? '') as string,
  });
  const [savingWarehouse, setSavingWarehouse] = useState(false);

  const handleSaveWarehouse = async () => {
    if (!warehouseDraft.street1.trim() || !warehouseDraft.city.trim() || !warehouseDraft.state.trim() || !warehouseDraft.zip.trim()) {
      toast.error('Street, City, State, and Zip are required.');
      return;
    }
    setSavingWarehouse(true);
    try {
      const res = await fetch('/api/agent/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'warehouse',
          data: {
            street1: warehouseDraft.street1.trim(),
            street2: warehouseDraft.street2.trim() || '',
            city:    warehouseDraft.city.trim(),
            state:   warehouseDraft.state.trim().toUpperCase(),
            zip:     warehouseDraft.zip.trim(),
            country: 'US',
          },
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to save warehouse address.');
      // Update local agent profile state so the completeness ring refreshes immediately
      setLocalAgentProfile((prev: any) => ({ ...prev, warehouse_address: json.warehouse_address }));
      toast.success('Warehouse address saved!');
      setExpandedTask(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save warehouse address.');
    } finally {
      setSavingWarehouse(false);
    }
  };

  const handleSaveInline = async (t: { id: string }) => {
    setSavingTask(true);
    const keyMap: Record<string, string> = {
      'first-name': 'first_name',
      'last-name': 'last_name',
      'email': 'email',
      'phone': 'phone',
      'timezone': 'timezone',
    };
    const key = keyMap[t.id] || t.id;
    try {
      await fetch('/api/agent/profile', { 
        method: 'PATCH', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [key]: inputValue }) 
      });
      if (profile) onProfileChange({ ...profile, [key]: inputValue } as AccountProfile);
    } catch(err) {
      toast.error(err instanceof Error ? err.message : 'Failed To Save. Please Try Again.');
    }
    setSavingTask(false);
    setExpandedTask(null);
  };

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
        className="glass-panel"
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
          <div style={{ color: 'var(--white)', fontSize: '0.9rem', marginTop: 2 }}>{userEmail || '-'}</div>
        </div>

        {completeness < 100 && (
          <ProfileCompletenessRing 
            percent={completeness} 
            onClick={() => setMissingTasksModalOpen(true)} 
          />
        )}
      </div>

      <div className="glass-panel" style={{ padding: 'var(--space-6)' }}>
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
              inputMode="numeric"
              className="form-input"
              value={draft.phone}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, '');
                let formatted = digits;
                if (digits.length > 3 && digits.length <= 6) formatted = `${digits.slice(0, 3)}-${digits.slice(3)}`;
                else if (digits.length > 6) formatted = `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
                setDraft((d) => ({ ...d, phone: formatted }));
              }}
              maxLength={12}
              autoComplete="tel"
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

      {missingTasksModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setMissingTasksModalOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.8)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 'var(--space-4)',
          }}
        >
          <div
            className="glass-panel"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 500, width: '100%', padding: 'var(--space-6)', maxHeight: '90vh', overflowY: 'auto', border: '3px solid #88929C', boxShadow: 'inset 0 0 15px rgba(0,0,0,0.7), 0 10px 30px rgba(0,0,0,0.5)' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
              <h3 style={{ margin: 0, color: 'var(--white)' }}>Complete Your Profile</h3>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setMissingTasksModalOpen(false)}>Close</button>
            </div>
            
            <p style={{ fontSize: '0.9rem', color: 'var(--silver)', marginBottom: 'var(--space-5)', lineHeight: 1.5 }}>
              You Are Currently At {completeness}% Profile Completion. Please Complete The Following Remaining Tasks To Get To 100%.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {missingTasks.map((t) => (
                <div key={t.id} style={{ display: 'flex', flexDirection: 'column', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      {getIcon(t.id)}
                      <span style={{ fontSize: '0.95rem', color: 'var(--white)', fontWeight: 500 }}>{t.label}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      {t.id === 'avatar' && (
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          style={{ minWidth: 100 }}
                          onClick={async () => {
                            try {
                              const res = await fetch('/api/agent/profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ avatar_url: 'default' }) });
                              if (res.ok) {
                                if (profile) onProfileChange?.({ ...profile, avatar_url: 'default' } as any);
                              }
                            } catch(err) {
                              toast.error(err instanceof Error ? err.message : 'Failed To Reset Avatar.');
                            }
                          }}
                        >
                          Use Default
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        disabled={expandedTask === t.id}
                        onClick={() => {
                          const isInlineEditable = ['first-name', 'last-name', 'email', 'email-verified', 'phone', 'timezone', 'avatar', 'warehouse'].includes(t.id);
                          if (isInlineEditable) {
                            setExpandedTask(t.id);
                            const keyMap: Record<string, string> = {
                              'first-name': 'first_name',
                              'last-name': 'last_name',
                              'email': 'email',
                              'email-verified': 'contact_email',
                              'phone': 'phone',
                              'timezone': 'timezone',
                            };
                            const dbKey = keyMap[t.id] || t.id;
                            setInputValue((profile as any)?.[dbKey] || '');
                          } else if (t.target.startsWith('modal:')) {
                            setMissingTasksModalOpen(false);
                            const id = t.target.split(':')[1];
                            if (id === 'username') setUsernameModalOpen(true);
                          } else if (t.target.startsWith('nav:')) {
                            setMissingTasksModalOpen(false);
                            router.push(t.target.slice(4));
                          } else {
                            setExpandedTask(t.id);
                            setInputValue('');
                          }
                        }}
                      >
                        {expandedTask === t.id ? 'Editing...' : t.actionText}
                      </button>
                    </div>
                  </div>
                  {expandedTask === t.id && (
                    <div style={{ padding: '0 16px 16px 16px', background: 'rgba(0,0,0,0.2)', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                      {t.id === 'avatar' ? (
                        <div style={{ marginTop: 16 }}>
                          <AvatarUpload 
                            currentAvatarUrl={null} 
                            name="User" 
                            onUploadSuccess={async (url) => {
                              try {
                                await fetch('/api/agent/profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ avatar_url: url }) });
                                if (profile) onProfileChange({ ...profile, avatar_url: url } as AccountProfile);
                              } catch(err) {
                                toast.error(err instanceof Error ? err.message : 'Failed To Save Avatar.');
                              }
                              setExpandedTask(null);
                            }}
                          />
                        </div>
                      ) : t.id === 'warehouse' ? (
                        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <input
                            className="form-input"
                            style={{ margin: 0 }}
                            placeholder="Street Address *"
                            value={warehouseDraft.street1}
                            onChange={e => setWarehouseDraft(d => ({ ...d, street1: e.target.value }))}
                            autoFocus
                          />
                          <input
                            className="form-input"
                            style={{ margin: 0 }}
                            placeholder="Apt / Suite (optional)"
                            value={warehouseDraft.street2}
                            onChange={e => setWarehouseDraft(d => ({ ...d, street2: e.target.value }))}
                          />
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 100px', gap: 8 }}>
                            <input
                              className="form-input"
                              style={{ margin: 0 }}
                              placeholder="City *"
                              value={warehouseDraft.city}
                              onChange={e => setWarehouseDraft(d => ({ ...d, city: e.target.value }))}
                            />
                            <input
                              className="form-input"
                              style={{ margin: 0 }}
                              placeholder="State *"
                              maxLength={2}
                              value={warehouseDraft.state}
                              onChange={e => setWarehouseDraft(d => ({ ...d, state: e.target.value }))}
                            />
                            <input
                              className="form-input"
                              style={{ margin: 0 }}
                              placeholder="Zip *"
                              maxLength={10}
                              value={warehouseDraft.zip}
                              onChange={e => setWarehouseDraft(d => ({ ...d, zip: e.target.value }))}
                            />
                          </div>
                          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
                            <button className="btn btn-ghost btn-sm" onClick={() => setExpandedTask(null)}>Cancel</button>
                            <button
                              className="btn btn-primary btn-sm"
                              disabled={savingWarehouse || !warehouseDraft.street1.trim() || !warehouseDraft.city.trim() || !warehouseDraft.state.trim() || !warehouseDraft.zip.trim()}
                              onClick={handleSaveWarehouse}
                            >
                              {savingWarehouse ? 'Saving...' : 'Save Address'}
                            </button>
                          </div>
                        </div>
                      ) : t.id === 'email-verified' ? (
                        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {emailVerifyError && (
                            <div style={{ padding: '8px 12px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 4, color: 'var(--red)', fontSize: '0.85rem' }}>
                              {emailVerifyError}
                            </div>
                          )}
                          {emailVerifyStep === 'email' ? (
                            <div style={{ display: 'flex', gap: 8 }}>
                              <input
                                type="email"
                                className="form-input"
                                style={{ flex: 1, margin: 0 }}
                                placeholder="Enter Your Real Email Address"
                                value={inputValue}
                                onChange={e => setInputValue(e.target.value)}
                                autoFocus
                              />
                              <button
                                className="btn btn-primary"
                                disabled={savingTask || !inputValue.trim()}
                                onClick={handleSendEmailVerification}
                              >
                                {savingTask ? 'Sending...' : 'Send Code'}
                              </button>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', gap: 8 }}>
                              <input
                                type="text"
                                inputMode="numeric"
                                maxLength={6}
                                className="form-input"
                                style={{ flex: 1, margin: 0, letterSpacing: '0.5em', textAlign: 'center', fontFamily: 'monospace', fontSize: '1.2rem' }}
                                placeholder="000000"
                                value={emailVerifyCode}
                                onChange={e => setEmailVerifyCode(e.target.value.replace(/\D/g, ''))}
                                autoFocus
                              />
                              <button
                                className="btn btn-primary"
                                disabled={savingTask || emailVerifyCode.length !== 6}
                                onClick={handleVerifyEmailCode}
                              >
                                {savingTask ? 'Verifying...' : 'Verify Code'}
                              </button>
                              <button
                                className="btn btn-ghost"
                                disabled={savingTask}
                                onClick={() => { setEmailVerifyStep('email'); setEmailVerifyError(null); }}
                              >
                                Back
                              </button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                          <input 
                            type={t.id === 'phone' ? 'tel' : t.id === 'email' ? 'email' : 'text'}
                            inputMode={t.id === 'phone' ? 'numeric' : undefined}
                            className="form-input" 
                            style={{ flex: 1, margin: 0 }} 
                            placeholder={`Enter ${t.label}`}
                            value={inputValue}
                            onChange={e => {
                              if (t.id === 'phone') {
                                const digits = e.target.value.replace(/\D/g, '');
                                let formatted = digits;
                                if (digits.length > 3 && digits.length <= 6) formatted = `${digits.slice(0, 3)}-${digits.slice(3)}`;
                                else if (digits.length > 6) formatted = `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
                                setInputValue(formatted);
                              } else {
                                setInputValue(e.target.value);
                              }
                            }}
                            autoFocus
                          />
                          <button 
                            className="btn btn-primary" 
                            disabled={savingTask || !inputValue.trim()}
                            onClick={() => handleSaveInline(t)}
                          >
                            {savingTask ? '...' : 'Save'}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
