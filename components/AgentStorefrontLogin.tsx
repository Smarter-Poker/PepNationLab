'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';


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
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(errorMessage || null);

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
            {displayName}
          </h2>
        </div>

        {error && (
          <div style={{ background: 'var(--red-bg)', borderLeft: '3px solid var(--red)', padding: 'var(--space-3)', marginBottom: 'var(--space-4)', borderRadius: '0 4px 4px 0' }}>
            <p style={{ color: 'var(--red)', fontSize: '0.8rem', margin: 0, fontWeight: 500 }}>{error}</p>
          </div>
        )}

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
        </form>


      </div>
    </div>
  );
}
