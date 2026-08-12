'use client';

import React, { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useTheme } from '@/components/ThemeProvider';
import AvatarUpload from '@/components/AvatarUpload';
import PushNotificationToggle from '@/components/PushNotificationToggle';
import { getRealEmail } from '@/lib/profile-utils';
import {
  MIN_PASSWORD_LENGTH,
  MAX_PASSWORD_LENGTH,
  PASSWORD_RULE_TEXT,
  PASSWORD_TOO_SHORT_ERROR,
} from '@/lib/password-policy';

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
      <h1 className="animated-gradient-text" style={{ marginBottom: 'var(--space-6)', fontSize: '1.8rem' }}>
        Account Settings
      </h1>

      <div className="glass-panel hover-lift" style={{ padding: 'var(--space-6)', marginBottom: 'var(--space-6)' }}>
        <h4 style={{ marginBottom: 'var(--space-2)', color: 'var(--teal)' }}>Profile Picture</h4>
        <p style={{ fontSize: '0.82rem', color: 'var(--grey-400)', marginBottom: 'var(--space-5)', marginTop: 0 }}>
          Upload A Profile Picture To Show In Messenger Instead Of A Generic Initial.
        </p>
        <AvatarUpload
          currentAvatarUrl={profile.avatar_url ?? null}
          name={profile.full_name ?? (getRealEmail(profile) || '')?.split('@')[0] ?? 'Admin'}
        />
      </div>

      <div className="glass-panel hover-lift" style={{ padding: 'var(--space-6)', marginBottom: 'var(--space-6)' }}>
        <h4 style={{ marginBottom: 'var(--space-4)', color: 'var(--teal)' }}>Account Information</h4>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div>
            <span style={{ fontSize: '0.78rem', color: 'var(--grey-400)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Email</span>
            <p style={{ fontFamily: 'monospace', color: 'var(--teal)', fontSize: '1rem', margin: '4px 0 0' }}>{(getRealEmail(profile) || '')}</p>
          </div>
          <div>
            <span style={{ fontSize: '0.78rem', color: 'var(--grey-400)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Name</span>
            <p style={{ color: 'var(--white)', fontSize: '0.9rem', margin: '4px 0 0' }}>{profile.full_name || '-'}</p>
          </div>
        </div>
      </div>

      <div className="glass-panel hover-lift" style={{ padding: 'var(--space-6)', marginBottom: 'var(--space-6)' }}>
        <h4 style={{ marginBottom: 'var(--space-4)', color: 'var(--teal)' }}>Change Password</h4>
        <SettingsPasswordForm />
      </div>

      <div style={{ marginTop: 'var(--space-6)' }}>
        <PushNotificationToggle
          title="Notification Settings"
          description="Enable Push Notifications On This Device For Incoming Calls And New Messages - Even When The App Is Closed."
        />
      </div>

      <ThemeToggleCard />
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
    if (newPw.length < MIN_PASSWORD_LENGTH) { setPwError(PASSWORD_TOO_SHORT_ERROR); return; }
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
        <input type="password" className="form-input" value={newPw} onChange={e => setNewPw(e.target.value)} placeholder={PASSWORD_RULE_TEXT} required minLength={MIN_PASSWORD_LENGTH} maxLength={MAX_PASSWORD_LENGTH} autoComplete="new-password" />
      </div>
      <div className="form-group" style={{ marginBottom: 'var(--space-4)' }}>
        <label className="form-label">Confirm New Password</label>
        <input type="password" className="form-input" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} placeholder="Re-Enter New Password" required minLength={MIN_PASSWORD_LENGTH} maxLength={MAX_PASSWORD_LENGTH} autoComplete="new-password" />
      </div>
      {pwError && <p style={{ color: 'var(--red)', fontSize: '0.85rem', marginBottom: 'var(--space-3)' }}>{pwError}</p>}
      {pwSuccess && <p style={{ color: 'var(--teal)', fontSize: '0.85rem', marginBottom: 'var(--space-3)' }}>{pwSuccess}</p>}
      <button type="submit" className="btn btn-primary" disabled={pwLoading || newPw.length < MIN_PASSWORD_LENGTH || newPw !== confirmPw}>
        {pwLoading ? 'Updating...' : 'Update Password'}
      </button>
    </form>
  );
}

function ThemeToggleCard() {
  const { theme, toggleTheme } = useTheme();
  const isLight = theme === 'light';

  return (
    <div className="glass-panel hover-lift" style={{ padding: 'var(--space-6)', marginTop: 'var(--space-6)' }}>
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
        border: '1px solid rgba(168,180,192,0.2)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <div style={{
            width: 40,
            height: 40,
            borderRadius: '50%',
            background: isLight
              ? 'linear-gradient(135deg, #E8EEF4 0%, #D0DAE4 100%)'
              : 'linear-gradient(135deg, #1A2A3A 0%, #2A3A4A 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: isLight ? '0 0 12px rgba(208,218,228,0.4)' : '0 0 12px rgba(168,180,192,0.2)',
            transition: 'all 0.3s ease',
          }}>
            {isLight ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00C4BC" strokeWidth="2" strokeLinecap="round">
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
              ? 'linear-gradient(135deg, #A8B4C0, #D0DAE4)'
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
