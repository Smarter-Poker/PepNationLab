'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ChangePasswordPage() {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [skipping, setSkipping] = useState(false);
  const [error, setError] = useState('');

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (newPassword.length < 6) {
      setError('Password Must Be At Least 6 Characters');
      return;
    }
    if (newPassword !== confirm) {
      setError('Passwords Do Not Match');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error || 'Failed To Update Password'); return; }
      router.push('/dashboard');
      router.refresh();
    } catch {
      setError('Network Error. Please Try Again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSkip() {
    setSkipping(true);
    try {
      await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skip: true }),
      });
      router.push('/dashboard');
      router.refresh();
    } catch {
      router.push('/dashboard');
    }
  }

  return (
    <div style={{
      minHeight: '100dvh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--black)',
      padding: '16px',
    }}>
      {/* Background glow */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'radial-gradient(ellipse at 50% 0%, rgba(0,196,188,0.06) 0%, transparent 60%)',
        pointerEvents: 'none',
      }} />

      {/* Brushed-steel outer frame */}
      <div style={{
        maxWidth: 460, width: '100%',
        borderRadius: 20,
        padding: 10,
        background: 'linear-gradient(145deg, #c8c2b8 0%, #a09890 30%, #8a847c 50%, #a09890 70%, #c8c2b8 100%)',
        boxShadow: '0 8px 48px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.35), inset 0 -1px 0 rgba(0,0,0,0.4)',
      }}>
        {/* Inner dark panel */}
        <div style={{
          borderRadius: 12,
          background: 'linear-gradient(180deg, #1a1f2e 0%, #141820 40%, #111520 100%)',
          padding: '32px 28px 28px',
          boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.6)',
        }}>
          {/* Icon */}
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 56, height: 56, borderRadius: '50%',
              background: 'rgba(0,196,188,0.12)', border: '1px solid rgba(0,196,188,0.3)',
              fontSize: '1.6rem',
            }}>🔑</div>
          </div>

          <h1 style={{
            fontSize: '1.4rem', fontWeight: 700, color: '#ffffff',
            textAlign: 'center', margin: '0 0 8px',
            fontFamily: 'var(--font-brand)',
          }}>
            Set Your Password
          </h1>
          <p style={{
            fontSize: '0.85rem', color: '#8a9ab0',
            textAlign: 'center', margin: '0 0 28px',
            lineHeight: 1.5,
          }}>
            You were given a temporary password.<br />
            We recommend changing it now.
          </p>

          {error && (
            <div style={{
              background: 'rgba(229,62,62,0.1)', border: '1px solid rgba(229,62,62,0.35)',
              borderRadius: 8, padding: '10px 14px', marginBottom: 20,
              fontSize: '0.82rem', color: '#fc8181',
            }}>{error}</div>
          )}

          <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {/* New Password */}
            <div style={{ marginBottom: 16 }}>
              <label style={{
                display: 'block', fontSize: '0.88rem', fontWeight: 700,
                color: '#d0d8e4', marginBottom: 8,
              }}>New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="At Least 6 Characters"
                required
                autoFocus
                style={{
                  width: '100%', boxSizing: 'border-box',
                  background: 'linear-gradient(180deg, #0a0c14 0%, #0d1018 100%)',
                  border: '1px solid #2a3045', borderRadius: 8,
                  padding: '13px 14px', color: '#ffffff', fontSize: '0.95rem',
                  outline: 'none', caretColor: '#00C4BC',
                  boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.7)',
                }}
                onFocus={e => { e.currentTarget.style.border = '1px solid #00C4BC'; }}
                onBlur={e => { e.currentTarget.style.border = '1px solid #2a3045'; }}
              />
            </div>

            {/* Confirm Password */}
            <div style={{ marginBottom: 24 }}>
              <label style={{
                display: 'block', fontSize: '0.88rem', fontWeight: 700,
                color: '#d0d8e4', marginBottom: 8,
              }}>Confirm Password</label>
              <input
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="Re-enter Password"
                required
                style={{
                  width: '100%', boxSizing: 'border-box',
                  background: 'linear-gradient(180deg, #0a0c14 0%, #0d1018 100%)',
                  border: '1px solid #2a3045', borderRadius: 8,
                  padding: '13px 14px', color: '#ffffff', fontSize: '0.95rem',
                  outline: 'none', caretColor: '#00C4BC',
                  boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.7)',
                }}
                onFocus={e => { e.currentTarget.style.border = '1px solid #00C4BC'; }}
                onBlur={e => { e.currentTarget.style.border = '1px solid #2a3045'; }}
              />
            </div>

            {/* Save button */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%', padding: '15px',
                background: 'linear-gradient(180deg, #DCD3C3 0%, #B3A992 100%)',
                border: 'none', borderRadius: 8,
                color: '#000000', fontSize: '1rem', fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.7 : 1,
                letterSpacing: '0.02em', marginBottom: 12,
                boxShadow: '0 4px 16px rgba(0,196,188,0.25)',
                transition: 'opacity 0.15s',
              }}
            >
              {loading ? 'Saving...' : 'Save New Password'}
            </button>

            {/* Skip */}
            <button
              type="button"
              onClick={handleSkip}
              disabled={skipping}
              style={{
                width: '100%', padding: '12px',
                background: 'transparent',
                border: '1px solid #2a3045', borderRadius: 8,
                color: '#5a6a7a', fontSize: '0.88rem',
                cursor: skipping ? 'not-allowed' : 'pointer',
                opacity: skipping ? 0.6 : 1,
                transition: 'color 0.15s, border-color 0.15s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.color = '#8a9ab0';
                e.currentTarget.style.borderColor = '#3a4560';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.color = '#5a6a7a';
                e.currentTarget.style.borderColor = '#2a3045';
              }}
            >
              {skipping ? 'Continuing...' : 'Skip & Keep Temporary Password'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
