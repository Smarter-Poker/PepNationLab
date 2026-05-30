'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Key } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showForgotPopup, setShowForgotPopup] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const supabase = createClient();
    const raw = identifier.trim();
    let authEmail: string;

    if (raw.includes('@')) {
      // Admin logging in with their real email — use as-is
      authEmail = raw;
    } else {
      // Everyone else — resolve username → email via server
      const res = await fetch('/api/auth/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: raw }),
      });
      const data = await res.json();
      if (!res.ok || !data.email) {
        setError('Invalid Username Or Password');
        setLoading(false);
        return;
      }
      authEmail = data.email;
    }

    const { error: authError } = await supabase.auth.signInWithPassword({
      email: authEmail,
      password,
    });

    if (authError) {
      setError('Invalid Username Or Password');
      setLoading(false);
      return;
    }

    // Single-session enforcement — deferred to avoid a race condition in
    // incognito mode where the signOut RPC can race against the new session
    // cookie being written, causing silent logout. We fire it 3 seconds after
    // navigation starts — by then the session cookie is safely committed.
    // Best-effort: failures are ignored (old sessions expire naturally).
    const supabaseForSignOut = supabase; // capture ref

    const redirectTo = searchParams.get('redirect') ?? '/dashboard';
    router.push(redirectTo);
    // Do NOT call router.refresh() here — it triggers a server re-render that
    // can race against the cookie being set in incognito, causing the middleware
    // to see no session and redirect back to /login.
    // The destination page's own useEffect / server component will load fresh data.

    setTimeout(() => {
      supabaseForSignOut.auth.signOut({ scope: 'others' }).catch(() => {});
    }, 3000);
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
      {/* Background Glow */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'radial-gradient(ellipse at 50% 0%, rgba(192,184,168,0.06) 0%, transparent 60%)',
        pointerEvents: 'none'
      }} />

      {/* Forgot Password Popup */}
      {showForgotPopup && (
        <div
          onClick={() => setShowForgotPopup(false)}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000,
            padding: 'var(--space-6)',
            backdropFilter: 'blur(4px)',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--grey-900)',
              border: '1px solid rgba(192,184,168,0.25)',
              borderRadius: 16,
              padding: 'var(--space-8)',
              maxWidth: 380,
              width: '100%',
              textAlign: 'center',
              boxShadow: '0 0 60px rgba(192,184,168,0.1)',
            }}
          >
            <div style={{
              width: 48, height: 48,
              borderRadius: '50%',
              background: 'rgba(192,184,168,0.12)',
              border: '1px solid rgba(192,184,168,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto var(--space-4)',
              color: 'var(--teal)',
            }}>
              <Key size={22} aria-hidden="true" />
            </div>
            <h3 style={{ fontSize: '1.1rem', marginBottom: 'var(--space-3)', color: 'var(--white)' }}>
              Password Reset
            </h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--grey-300)', lineHeight: 1.6 }}>
              Contact Your Research Agent If You Forgot Your Password Or Need It Reset
            </p>
            <button
              onClick={() => setShowForgotPopup(false)}
              className="btn btn-primary"
              style={{ marginTop: 'var(--space-6)', width: '100%', justifyContent: 'center' }}
            >
              Got It
            </button>
          </div>
        </div>
      )}

      <div style={{ width: '100%', maxWidth: 420, position: 'relative' }}>
        <div className="card-metal" style={{ padding: 'var(--space-8)' }}>
          <h2 style={{ marginBottom: 'var(--space-2)', fontSize: '1.4rem' }}>Sign In</h2>
          <p style={{ marginBottom: 'var(--space-6)', fontSize: '0.85rem', color: 'var(--grey-400)' }}>
            Access Your Account
          </p>

          {error && (
            <div className="disclaimer-warning" style={{ marginBottom: 'var(--space-4)', padding: 'var(--space-3) var(--space-4)' }}>
              <p style={{ fontSize: '0.85rem', color: 'var(--red)' }}>{error}</p>
            </div>
          )}

          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label className="form-label" htmlFor="identifier">Username</label>
              <input
                id="identifier"
                type="text"
                className="form-input"
                placeholder="Enter Your Username"
                value={identifier}
                onChange={e => setIdentifier(e.target.value)}
                required
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                className="form-input"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>

            <div style={{ textAlign: 'right', marginBottom: 'var(--space-6)', marginTop: 'var(--space-2)' }}>
              <button
                type="button"
                onClick={() => setShowForgotPopup(true)}
                style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: '0.8rem', color: 'var(--teal)' }}
              >
                Forgot Password?
              </button>
            </div>

            <button
              type="submit"
              id="login-submit"
              className="btn btn-primary"
              disabled={loading}
              style={{ width: '100%', justifyContent: 'center', opacity: loading ? 0.7 : 1 }}
            >
              {loading ? 'Signing In...' : 'Sign In'}
            </button>
          </form>

          <div style={{
            marginTop: 'var(--space-6)',
            paddingTop: 'var(--space-6)',
            borderTop: '1px solid rgba(255,255,255,0.06)',
            textAlign: 'center'
          }}>
            <p style={{ fontSize: '0.8rem', color: 'var(--grey-600)' }}>
              Access Is By Invitation Only. Contact Your Administrator For Access.
            </p>
          </div>
        </div>

        <p style={{ marginTop: 'var(--space-4)', textAlign: 'center', fontSize: '0.75rem', color: 'var(--grey-600)' }}>
          For Qualified Researchers Only. Research Use Only.
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--black)' }}>
        <div style={{ width: 40, height: 40, borderRadius: '50%', border: '2px solid var(--teal)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    }>
      <LoginPageInner />
    </Suspense>
  );
}
