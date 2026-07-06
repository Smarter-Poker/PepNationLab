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

    try {
      const supabase = createClient();
      const raw = identifier.trim();
      let authEmail: string;

      if (raw.includes('@')) {
        // Admin logging in with their real email - use as-is
        authEmail = raw;
      } else {
        // Everyone else - resolve username -> email via server
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

      // Single-session enforcement - deferred to avoid a race condition in
      // incognito mode where the signOut RPC can race against the new session
      // cookie being written, causing silent logout. We fire it 3 seconds after
      // navigation starts - by then the session cookie is safely committed.
      // Best-effort: failures are ignored (old sessions expire naturally).
      // Record session
      fetch('/api/agent/sessions', { method: 'POST' }).catch(() => {});

      const rawRedirect = searchParams.get('redirect') ?? '/dashboard';
      // Prevent open redirect: only allow relative paths starting with /
      // Reject anything with a protocol, double-slash, or backslash.
      const redirectTo = /^\/(?!\/|\\)/.test(rawRedirect) ? rawRedirect : '/dashboard';

      // Wait until Supabase confirms the session is readable locally (max 3s).
      // On mobile incognito the cookie write is async - navigating too soon
      // means the server request arrives before the cookie exists.
      for (let i = 0; i < 15; i++) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) break;
        await new Promise(r => setTimeout(r, 200));
      }

      // Hard navigation ensures that the browser sends the new session cookie to the server
      // and completely bypasses any Next.js client-side router cache that might be stale.
      // Using .replace() keeps the login page out of the history stack, so the back button works perfectly.
      window.location.replace(redirectTo);
    } catch (err) {
      setError('Something Went Wrong. Please Try Again.');
    } finally {
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
            zIndex: 9999,
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
        <div className="glass-panel hover-lift stagger-fade-in" style={{ padding: 'var(--space-8)', boxShadow: '0 0 40px rgba(104,211,145,0.05)' }}>
          <h2 className="animated-gradient-text" style={{ marginBottom: 'var(--space-2)', fontSize: '1.4rem' }}>Sign In</h2>
          <p style={{ marginBottom: 'var(--space-6)', fontSize: '0.85rem', color: 'var(--grey-400)' }}>
            Access Your Account
          </p>

          {error && (
            <div className="disclaimer-warning" style={{ marginBottom: 'var(--space-4)', padding: 'var(--space-3) var(--space-4)' }}>
              <p style={{ fontSize: '0.85rem', color: 'var(--red)' }}>{error}</p>
            </div>
          )}

          <form onSubmit={handleLogin}>
            <div className="form-group stagger-fade-in stagger-1">
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

            <div className="form-group stagger-fade-in stagger-2">
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
              className="btn btn-primary stagger-fade-in stagger-3 hover-lift"
              style={{ width: '100%', justifyContent: 'center' }}
              disabled={loading || !identifier || !password}
            >
              {loading ? 'Authenticating...' : 'Sign In To Laboratory'}
            </button>
          </form>

          <div style={{
            marginTop: 'var(--space-6)',
            paddingTop: 'var(--space-6)',
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
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--black)' }}>
        <div style={{ width: 40, height: 40, borderRadius: '50%', border: '2px solid var(--teal)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    }>
      <LoginPageInner />
    </Suspense>
  );
}
