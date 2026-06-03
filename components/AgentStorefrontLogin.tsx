'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import UniqueField from '@/components/UniqueField';

interface Props {
  agentSlug: string;
  displayName: string;
  primaryColor: string;
  logoUrl?: string | null;
  errorMessage?: string | null;
}

export default function AgentStorefrontLogin({
  agentSlug,
  displayName,
  primaryColor,
  logoUrl,
  errorMessage
}: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(errorMessage || null);
  const [success, setSuccess] = useState<string | null>(null);
  const [referralCode, setReferralCode] = useState<string>('');
  // SACA Phase 3: optional sub-agent tag picked up from ?sa=<uuid> in the URL.
  const [subAgentId, setSubAgentId] = useState<string>('');
  // Reservation token from the live availability check, sent on submit.
  const [usernameReservationToken, setUsernameReservationToken] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const params = new URLSearchParams(window.location.search);
      const ref = params.get('ref');
      if (ref && /^[A-Za-z0-9]{1,32}$/.test(ref)) {
        setReferralCode(ref.toUpperCase());
        setMode('register');
      }
      // SACA Phase 3: optional sub-agent referral tag. Format: ?sa=<uuid>.
      const sa = params.get('sa');
      if (sa && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sa)) {
        setSubAgentId(sa.toLowerCase());
        setMode('register');
      }
    } catch {
      /* ignore */
    }
  }, []);

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
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: authEmail,
        password,
      });

      if (authError) {
        throw new Error('Invalid Username Or Password');
      }

      if (!authData?.user?.id) {
        throw new Error('Sign In Failed. Please Try Again.');
      }

      const verifyRes = await fetch('/api/auth/verify-agent-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: authData.user.id, agentSlug }),
      });

      if (!verifyRes.ok && verifyRes.status !== 200) {
        await supabase.auth.signOut();
        throw new Error('Access verification failed. Please try again.');
      }

      const verifyData = await verifyRes.json();
      if (!verifyData.allowed) {
        await supabase.auth.signOut();
        throw new Error(verifyData.reason || 'This Account Does Not Belong To This Store.');
      }

      supabase.auth.signOut({ scope: 'others' }).catch(() => {});

      let cookieFound = false;
      for (let i = 0; i < 20; i++) {
        if (document.cookie.includes('sb-') && document.cookie.includes('-auth-token')) {
          cookieFound = true;
          break;
        }
        await new Promise(r => setTimeout(r, 150));
      }

      if (!cookieFound) {
        await new Promise(r => setTimeout(r, 1000));
      }

      router.refresh();
    } catch (err: any) {
      setError(err.message || 'Sign In Failed. Please Try Again.');
      setLoading(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      if (!firstName.trim() || !lastName.trim() || !username.trim() || !password.trim()) {
        throw new Error('All Fields Are Required');
      }
      if (password.length < 8) {
        throw new Error('Password Must Be At Least 8 Characters');
      }

      const res = await fetch('/api/storefront/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: agentSlug,
          username: username.trim(),
          password: password.trim(),
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          referralCode: referralCode || undefined,
          subAgentId: subAgentId || undefined,
          reservationToken: usernameReservationToken || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Registration Failed');
      }

      const email = data.email || `${username.trim()}@internal.auth`;
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password: password.trim(),
      });

      if (authError) {
        setSuccess('Account Created Successfully. Please Sign In.');
        setMode('login');
        setLoading(false);
        return;
      }

      supabase.auth.signOut({ scope: 'others' }).catch(() => {});

      let cookieFound = false;
      for (let i = 0; i < 20; i++) {
        if (document.cookie.includes('sb-') && document.cookie.includes('-auth-token')) {
          cookieFound = true;
          break;
        }
        await new Promise(r => setTimeout(r, 150));
      }

      if (!cookieFound) {
        await new Promise(r => setTimeout(r, 1000));
      }

      router.refresh();
    } catch (err: any) {
      setError(err.message || 'Network Error');
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: '100dvh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--black)',
      padding: 'var(--space-6)'
    }}>
      <div className="glass-panel" style={{
        maxWidth: 420,
        width: '100%',
        padding: 'var(--space-8)',
        border: `1px solid ${primaryColor}40`,
        boxShadow: `0 0 30px ${primaryColor}20`
      }}>
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-6)' }}>
          <h2 style={{ color: 'var(--white)', fontSize: '1.4rem', fontFamily: 'var(--font-brand)', marginBottom: 'var(--space-1)' }}>
            Pep Nation&apos;s Research Store
          </h2>
        </div>

        {error && (
          <div style={{ background: 'var(--red-bg)', borderLeft: '3px solid var(--red)', padding: 'var(--space-3)', marginBottom: 'var(--space-4)', borderRadius: '0 4px 4px 0' }}>
            <p style={{ color: 'var(--red)', fontSize: '0.8rem', margin: 0, fontWeight: 500 }}>{error}</p>
          </div>
        )}
        {success && (
          <div style={{ background: 'rgba(192,184,168,0.06)', borderLeft: `3px solid ${primaryColor}`, padding: 'var(--space-3)', marginBottom: 'var(--space-4)', borderRadius: '0 4px 4px 0' }}>
            <p style={{ color: primaryColor, fontSize: '0.8rem', margin: 0, fontWeight: 500 }}>{success}</p>
          </div>
        )}

        {/* LOGIN FORM */}
        {mode === 'login' && (
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div className="form-group">
              <label className="form-label" style={{ color: primaryColor }}>Username</label>
              <input
                type="text"
                className="form-input"
                placeholder="Provided By Your Agent"
                value={username}
                onChange={e => setUsername(e.target.value)}
                required
                autoFocus
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
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
                color: 'var(--white)',
                boxShadow: `0 4px 16px ${primaryColor}40`
              }}
            >
              {loading ? 'Signing In...' : 'Sign In'}
            </button>
            <p style={{ textAlign: 'center', marginTop: 'var(--space-4)', fontSize: '0.8rem', color: 'var(--grey-400)' }}>
              New Researcher?{' '}
              <button type="button" onClick={() => { setMode('register'); setError(null); }} style={{ background: 'none', border: 'none', color: primaryColor, cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem', textDecoration: 'underline' }}>Create Account</button>
            </p>
          </form>
        )}

        {/* REGISTER FORM */}
        {mode === 'register' && (
          <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label" style={{ color: primaryColor }}>First Name</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="First"
                  value={firstName}
                  onChange={e => setFirstName(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label" style={{ color: primaryColor }}>Last Name</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Last"
                  value={lastName}
                  onChange={e => setLastName(e.target.value)}
                  required
                />
              </div>
            </div>
            <UniqueField
              field="username"
              label="Choose A Username"
              value={username}
              onChange={setUsername}
              onTokenChange={setUsernameReservationToken}
              labelColor={primaryColor}
              placeholder="E.g. John_Doe"
              required
            />
            <div className="form-group">
              <label className="form-label" style={{ color: primaryColor }}>Create A Password</label>
              <input
                type="password"
                className="form-input"
                placeholder="Min. 8 Characters"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
              style={{
                marginTop: 'var(--space-2)',
                background: `linear-gradient(135deg, ${primaryColor}, ${primaryColor}90)`,
                color: 'var(--white)',
                boxShadow: `0 4px 16px ${primaryColor}40`,
                opacity: loading ? 0.7 : 1,
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              {loading ? 'Creating Account...' : 'Create Account & Enter'}
            </button>
            <p style={{ textAlign: 'center', marginTop: 'var(--space-4)', fontSize: '0.8rem', color: 'var(--grey-400)' }}>
              Already Have An Account?{' '}
              <button type="button" onClick={() => { setMode('login'); setError(null); }} style={{ background: 'none', border: 'none', color: primaryColor, cursor: 'pointer', fontWeight: 600, fontSize: '0.8rem', textDecoration: 'underline' }}>Sign In</button>
            </p>
          </form>
        )}


      </div>
    </div>
  );
}
