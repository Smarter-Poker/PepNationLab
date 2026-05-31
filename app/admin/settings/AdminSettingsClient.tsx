'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useTheme } from '@/components/ThemeProvider';
import AvatarUpload from '@/components/AvatarUpload';

interface AdminSettingsClientProps {
  profile: {
    id: string;
    full_name: string | null;
    email: string;
    avatar_url: string | null;
  };
}

export default function AdminSettingsClient({ profile }: AdminSettingsClientProps) {
  return (
    <div style={{ padding: 'var(--space-6)', maxWidth: 600, margin: '0 auto', animation: 'fadeIn 0.3s ease-out' }}>
      <h1 style={{ fontFamily: 'var(--font-brand)', marginBottom: 'var(--space-6)', fontSize: '1.8rem', color: 'var(--white)' }}>
        Account Settings
      </h1>

      {/* Profile Picture Upload */}
      <div className="card-metal hover-lift" style={{ padding: 'var(--space-6)', marginBottom: 'var(--space-6)' }}>
        <h4 style={{ marginBottom: 'var(--space-2)', color: 'var(--teal)' }}>Profile Picture</h4>
        <p style={{ fontSize: '0.82rem', color: 'var(--grey-400)', marginBottom: 'var(--space-5)', marginTop: 0 }}>
          Upload a profile picture to show in Messenger instead of a generic initial.
        </p>
        <AvatarUpload 
          currentAvatarUrl={profile.avatar_url ?? null} 
          name={profile.full_name ?? profile.email?.split('@')[0] ?? 'Admin'} 
        />
      </div>

      {/* Account Info */}
      <div className="card-metal hover-lift" style={{ padding: 'var(--space-6)', marginBottom: 'var(--space-6)' }}>
        <h4 style={{ marginBottom: 'var(--space-4)', color: 'var(--teal)' }}>Account Information</h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div>
            <span style={{ fontSize: '0.78rem', color: 'var(--grey-400)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Email</span>
            <p style={{ fontFamily: 'monospace', color: 'var(--teal)', fontSize: '1rem', margin: '4px 0 0' }}>{profile.email}</p>
          </div>
          <div>
            <span style={{ fontSize: '0.78rem', color: 'var(--grey-400)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Name</span>
            <p style={{ color: 'var(--white)', fontSize: '0.9rem', margin: '4px 0 0' }}>{profile.full_name || '—'}</p>
          </div>
        </div>
      </div>

      {/* Change Password */}
      <div className="card-metal hover-lift" style={{ padding: 'var(--space-6)', marginBottom: 'var(--space-6)' }}>
        <h4 style={{ marginBottom: 'var(--space-4)', color: 'var(--teal)' }}>Change Password</h4>
        <SettingsPasswordForm />
      </div>

      {/* Notification Preferences */}
      <div className="card-metal hover-lift" style={{ padding: 'var(--space-6)', marginTop: 'var(--space-6)' }}>
        <h4 style={{ marginBottom: 'var(--space-2)', color: 'var(--teal)' }}>Notification Preferences</h4>
        <p style={{ fontSize: '0.82rem', color: 'var(--grey-400)', marginBottom: 'var(--space-4)', marginTop: 0 }}>
          Manage Push Notifications For New Messages When The Tab Is Hidden.
        </p>
        <NotificationPrefsPanel />
      </div>

      {/* Theme Preferences */}
      <ThemeToggleCard />
    </div>
  );
}

function NotificationPrefsPanel() {
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default');
  const [browserPush, setBrowserPush] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (typeof Notification === 'undefined') {
      setPermission('unsupported');
      setLoaded(true);
      return;
    }
    setPermission(Notification.permission);
    // Load saved pref from DB
    fetch('/api/messenger/notification-prefs', { cache: 'no-store' })
      .then(r => r.json())
      .then((j: { prefs?: { browser_push?: boolean | null } }) => {
        setBrowserPush(Boolean(j.prefs?.browser_push));
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  async function handleEnable() {
    if (typeof Notification === 'undefined') return;
    setSaving(true);
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result === 'granted') {
        const res = await fetch('/api/messenger/notification-prefs', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ browserPush: true }),
        });
        if (res.ok) {
          setBrowserPush(true);
          try {
            window.dispatchEvent(new CustomEvent('messenger:prefs-updated', { detail: { browser_push: true } }));
          } catch { /* non-fatal */ }
        }
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDisable() {
    setSaving(true);
    try {
      const res = await fetch('/api/messenger/notification-prefs', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ browserPush: false }),
      });
      if (res.ok) {
        setBrowserPush(false);
        try {
          window.dispatchEvent(new CustomEvent('messenger:prefs-updated', { detail: { browser_push: false } }));
        } catch { /* non-fatal */ }
      }
    } finally {
      setSaving(false);
    }
  }

  if (!loaded) {
    return <p style={{ fontSize: '0.82rem', color: 'var(--grey-400)' }}>Loading...</p>;
  }

  if (permission === 'unsupported') {
    return <p style={{ fontSize: '0.82rem', color: 'var(--grey-400)' }}>Push Notifications Are Not Supported In This Browser.</p>;
  }

  if (permission === 'denied') {
    return (
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--red)', marginTop: 4, flexShrink: 0 }} />
        <div>
          <p style={{ fontSize: '0.85rem', color: 'var(--white)', margin: '0 0 4px', fontWeight: 600 }}>Push Notifications Blocked</p>
          <p style={{ fontSize: '0.78rem', color: 'var(--grey-400)', margin: 0 }}>
            Your Browser Has Blocked Notifications For This Site. To Enable Them, Go To Your Browser Settings And Allow Notifications For This Domain.
          </p>
        </div>
      </div>
    );
  }

  const isEnabled = permission === 'granted' && browserPush === true;

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
          background: isEnabled ? 'var(--teal)' : 'var(--grey-500)',
        }} />
        <div>
          <p style={{ fontSize: '0.85rem', color: 'var(--white)', margin: '0 0 2px', fontWeight: 600 }}>
            {isEnabled ? 'Push Notifications Enabled' : 'Push Notifications Disabled'}
          </p>
          <p style={{ fontSize: '0.75rem', color: 'var(--grey-400)', margin: 0 }}>
            {isEnabled ? 'You Will Receive Alerts When A New Message Arrives.' : 'Enable To Get Alerts When The Tab Is Hidden.'}
          </p>
        </div>
      </div>
      {isEnabled ? (
        <button
          type="button"
          onClick={handleDisable}
          disabled={saving}
          className="btn btn-secondary btn-sm"
          style={{ flexShrink: 0, minWidth: 90 }}
        >
          {saving ? 'Saving...' : 'Disable'}
        </button>
      ) : (
        <button
          type="button"
          onClick={handleEnable}
          disabled={saving}
          className="btn btn-primary btn-sm"
          style={{ flexShrink: 0, minWidth: 90 }}
        >
          {saving ? 'Saving...' : 'Enable'}
        </button>
      )}
    </div>
  );
}

function SettingsPasswordForm() {
  const supabase = createClient();
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');

  const handleChangePw = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError('');
    setPwSuccess('');
    if (newPw !== confirmPw) { setPwError('Passwords Do Not Match'); return; }
    if (newPw.length < 8) { setPwError('Password Must Be At Least 8 Characters'); return; }
    setPwLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPw });
      if (error) throw error;
      setPwSuccess('Password Updated Successfully!');
      setNewPw(''); setConfirmPw('');
      setTimeout(() => setPwSuccess(''), 3000);
    } catch (err: any) {
      setPwError(err.message || 'Failed To Update Password');
    } finally {
      setPwLoading(false);
    }
  };

  return (
    <form onSubmit={handleChangePw}>
      <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
        <label className="form-label">New Password</label>
        <input type="password" className="form-input" value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="Minimum 8 Characters" required minLength={8} autoComplete="new-password" />
      </div>
      <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
        <label className="form-label">Confirm New Password</label>
        <input type="password" className="form-input" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} placeholder="Re-Enter New Password" required minLength={8} autoComplete="new-password" />
      </div>
      {pwError && <p style={{ color: 'var(--red)', fontSize: '0.85rem', marginBottom: 'var(--space-3)' }}>{pwError}</p>}
      {pwSuccess && <p style={{ color: 'var(--teal)', fontSize: '0.85rem', marginBottom: 'var(--space-3)' }}>{pwSuccess}</p>}
      <button type="submit" className="btn btn-primary" disabled={pwLoading || newPw.length < 8 || newPw !== confirmPw}>
        {pwLoading ? 'Updating...' : 'Update Password'}
      </button>
    </form>
  );
}

function ThemeToggleCard() {
  const { theme, toggleTheme } = useTheme();
  const isLight = theme === 'light';

  return (
    <div className="card-metal hover-lift" style={{ padding: 'var(--space-6)', marginTop: 'var(--space-6)' }}>
      <h4 style={{ marginBottom: 'var(--space-2)', color: 'var(--teal)' }}>Display Theme</h4>
      <p style={{ fontSize: '0.82rem', color: 'var(--grey-400)', marginBottom: 'var(--space-5)', marginTop: 0 }}>
        Switch Between Dark Mode And Light Mode. Your Preference Is Saved Automatically.
      </p>

      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 'var(--space-4)',
        background: isLight ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.04)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid rgba(192,184,168,0.2)',
      }}>
        {/* Icon + Label */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <div style={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            background: isLight
              ? 'linear-gradient(135deg, #FFF4D6 0%, #FFE082 100%)'
              : 'linear-gradient(135deg, #1A2A3A 0%, #2A3A4A 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: isLight ? '0 0 12px rgba(255,193,7,0.4)' : '0 0 12px rgba(192,184,168,0.2)',
            transition: 'all 0.3s ease',
          }}>
            {isLight ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="12" r="5"/>
                <line x1="12" y1="1" x2="12" y2="3"/>
                <line x1="12" y1="21" x2="12" y2="23"/>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                <line x1="1" y1="12" x2="3" y2="12"/>
                <line x1="21" y1="12" x2="23" y2="12"/>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--teal)" strokeWidth="2" strokeLinecap="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
              </svg>
            )}
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.92rem', color: 'var(--white)' }}>
              {isLight ? 'Light Mode' : 'Dark Mode'}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--grey-400)', marginTop: 2 }}>
              {isLight ? 'Warm Off-White Theme' : 'Premium Dark Theme'}
            </div>
          </div>
        </div>

        {/* Toggle switch */}
        <button
          onClick={toggleTheme}
          aria-label={isLight ? 'Switch To Dark Mode' : 'Switch To Light Mode'}
          style={{
            width: 52,
            height: 28,
            borderRadius: 14,
            border: 'none',
            cursor: 'pointer',
            background: isLight
              ? 'linear-gradient(135deg, #F59E0B, #FCD34D)'
              : 'linear-gradient(135deg, var(--teal-dark), var(--teal))',
            position: 'relative',
            transition: 'background 0.3s ease',
            flexShrink: 0,
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
          }}
        >
          <div style={{
            position: 'absolute',
            top: 3,
            left: isLight ? 'calc(100% - 25px)' : 3,
            width: 22,
            height: 22,
            borderRadius: '50%',
            background: '#FFFFFF',
            boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
            transition: 'left 0.28s cubic-bezier(0.4, 0, 0.2, 1)',
          }} />
        </button>
      </div>
    </div>
  );
}
