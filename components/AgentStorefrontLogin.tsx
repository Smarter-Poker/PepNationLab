'use client';

import React, { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

interface Props {
  agentSlug: string;
  displayName: string;
  primaryColor: string;
  logoUrl?: string | null;
  tagline?: string | null;
}

export default function AgentStorefrontLogin({
  agentSlug,
  displayName,
  primaryColor,
  logoUrl,
  tagline
}: Props) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const raw = username.trim();
      let authEmail: string;

      if (raw.includes('@')) {
        authEmail = raw;
      } else {
        // Resolve username to email via server
        const res = await fetch('/api/auth/resolve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: raw }),
        });
        const data = await res.json();
        if (!res.ok || !data.email) {
          throw new Error('Invalid Username Or Password');
        }
        authEmail = data.email;
      }

      const supabase = createClient();
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: authEmail,
        password,
      });

      if (authError) {
        throw new Error('Invalid Username Or Password');
      }

      // Success — reload to show the storefront catalog
      window.location.reload();
    } catch (err: any) {
      setError(err.message || 'Network Error');
      setLoading(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      if (!fullName.trim() || !username.trim() || !password.trim()) {
        throw new Error('All Fields Are Required');
      }
      if (password.length < 6) {
        throw new Error('Password Must Be At Least 6 Characters');
      }

      // Use the agent's create-researcher endpoint to create the account tied to this agent
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: fullName.trim(),
          username: username.trim(),
          password: password.trim(),
          agent_slug: agentSlug,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Registration Failed');
      }

      // Account created — now sign them in
      const email = data.email || `${username.trim()}@pepnationlab.com`;
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password: password.trim(),
      });

      if (authError) {
        // Account created but auto-login failed — prompt manual login
        setSuccess('Account Created Successfully! Please Sign In.');
        setMode('login');
        setLoading(false);
        return;
      }

      // Auto-login succeeded — reload to show storefront
      window.location.reload();
    } catch (err: any) {
      setError(err.message || 'Network Error');
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--black)',
      padding: 'var(--space-6)'
    }}>
      <div className="card-metal" style={{
        maxWidth: 420,
        width: '100%',
        padding: 'var(--space-8)',
        border: `1px solid ${primaryColor}40`,
        boxShadow: `0 0 30px ${primaryColor}20`
      }}>
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-6)' }}>
          {logoUrl ? (
            <img src={logoUrl} alt={displayName} style={{ height: 60, borderRadius: 8, marginBottom: 'var(--space-4)' }} />
          ) : (
            <div style={{
              width: 64, height: 64, borderRadius: 12, margin: '0 auto var(--space-4)',
              background: `linear-gradient(135deg, ${primaryColor}40, var(--surface-2))`,
              border: `1px solid ${primaryColor}50`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--font-brand)', fontWeight: 800, fontSize: '1.5rem',
              color: primaryColor
            }}>
              {displayName[0].toUpperCase()}
            </div>
          )}
          <h2 style={{ color: 'var(--white)', fontSize: '1.2rem', marginBottom: 'var(--space-2)' }}>
            {displayName}
          </h2>
          {tagline && (
            <p style={{ color: 'var(--silver)', fontSize: '0.85rem' }}>{tagline}</p>
          )}
        </div>

        {/* Mode Toggle Tabs */}
        <div style={{
          display: 'flex',
          marginBottom: 'var(--space-5)',
          background: 'var(--surface-2)',
          borderRadius: 'var(--radius-md)',
          padding: 3,
        }}>
          <button
            type="button"
            onClick={() => { setMode('login'); setError(null); setSuccess(null); }}
            style={{
              flex: 1,
              padding: '8px 0',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              fontSize: '0.85rem',
              fontWeight: 600,
              background: mode === 'login' ? primaryColor : 'transparent',
              color: mode === 'login' ? 'var(--black)' : 'var(--grey-400)',
              transition: 'all 0.2s',
            }}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setMode('register'); setError(null); setSuccess(null); }}
            style={{
              flex: 1,
              padding: '8px 0',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              fontSize: '0.85rem',
              fontWeight: 600,
              background: mode === 'register' ? primaryColor : 'transparent',
              color: mode === 'register' ? 'var(--black)' : 'var(--grey-400)',
              transition: 'all 0.2s',
            }}
          >
            Create Account
          </button>
        </div>

        {error && (
          <div style={{ background: 'var(--red-bg)', borderLeft: '3px solid var(--red)', padding: 'var(--space-3)', marginBottom: 'var(--space-4)', borderRadius: '0 4px 4px 0' }}>
            <p style={{ color: 'var(--red)', fontSize: '0.8rem', margin: 0, fontWeight: 500, textTransform: 'none' }}>{error}</p>
          </div>
        )}
        {success && (
          <div style={{ background: 'rgba(0,196,188,0.06)', borderLeft: `3px solid ${primaryColor}`, padding: 'var(--space-3)', marginBottom: 'var(--space-4)', borderRadius: '0 4px 4px 0' }}>
            <p style={{ color: primaryColor, fontSize: '0.8rem', margin: 0, fontWeight: 500, textTransform: 'none' }}>{success}</p>
          </div>
        )}

        {/* LOGIN FORM */}
        {mode === 'login' && (
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div className="form-group">
              <label className="form-label" style={{ color: primaryColor }}>Username Or Email</label>
              <input
                type="text"
                className="form-input"
                placeholder="Provided By Your Agent"
                value={username}
                onChange={e => setUsername(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="form-group">
              <label className="form-label" style={{ color: primaryColor }}>Password</label>
              <input
                type="password"
                className="form-input"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{
                marginTop: 'var(--space-2)',
                background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}90)`,
                color: 'var(--black)',
                boxShadow: `0 4px 16px ${primaryColor}40`
              }}
            >
              {loading ? 'Authenticating...' : 'Enter Storefront'}
            </button>
          </form>
        )}

        {/* REGISTER FORM */}
        {mode === 'register' && (
          <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div className="form-group">
              <label className="form-label" style={{ color: primaryColor }}>Full Name</label>
              <input
                type="text"
                className="form-input"
                placeholder="Your Full Name"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="form-group">
              <label className="form-label" style={{ color: primaryColor }}>Choose A Username</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. john_doe"
                value={username}
                onChange={e => setUsername(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label" style={{ color: primaryColor }}>Create A Password</label>
              <input
                type="password"
                className="form-input"
                placeholder="Min. 6 Characters"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{
                marginTop: 'var(--space-2)',
                background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}90)`,
                color: 'var(--black)',
                boxShadow: `0 4px 16px ${primaryColor}40`
              }}
            >
              {loading ? 'Creating Account...' : 'Create Account & Enter'}
            </button>
          </form>
        )}

        <div style={{ textAlign: 'center', marginTop: 'var(--space-6)', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 'var(--space-4)' }}>
          <p style={{ fontSize: '0.75rem', color: 'var(--grey-400)', textTransform: 'none' }}>
            Powered By PepNationLab White-Label Infrastructure
          </p>
        </div>
      </div>
    </div>
  );
}
