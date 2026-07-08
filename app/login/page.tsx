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
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState(() => {
    const err = searchParams.get('error');
    if (err === 'oauth_failed') return 'Google Sign-In Failed. Please Try Again Or Use Your Username.';
    if (err === 'account_disabled') return 'Your Account Has Been Disabled. Contact Your Administrator.';
    return '';
  });
  const [showForgotPopup, setShowForgotPopup] = useState(false);

  async function handleGoogleLogin() {
    if (googleLoading) return;
    setGoogleLoading(true);
    setError('');
    try {
      const supabase = createClient();
      const rawRedirect = searchParams.get('redirect') ?? '/dashboard';
      const redirectTo = /^\/(?!\/|\\)/.test(rawRedirect) ? rawRedirect : '/dashboard';
      
      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(redirectTo)}`,
        },
      });
      
      if (oauthError) {
        console.error('[Google Login] OAuth Error:', oauthError);
        setError('Google Sign-In Is Not Available Right Now. Please Use Your Username.');
        setGoogleLoading(false);
      } else if (!data?.url) {
        // Fallback in case the provider URL wasn't returned
        console.error('[Google Login] No provider URL returned.');
        setError('Google Sign-In Is Not Available Right Now. Please Use Your Username.');
        setGoogleLoading(false);
      }
      // If successful, the page will redirect automatically.
    } catch (err) {
      console.error('[Google Login] Unexpected Error:', err);
      setError('Google Sign-In Is Not Available Right Now. Please Use Your Username.');
      setGoogleLoading(false);
    }
  }

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
          <h2 className="animated-gradient-text" style={{ marginBottom: 'var(--space-2)', fontSize: '1.4rem', textAlign: 'center' }}>Sign In</h2>
          <p style={{ marginBottom: 'var(--space-6)', fontSize: '0.85rem', color: 'var(--grey-400)', textAlign: 'center' }}>
            Access Your Account
          </p>

          {error && (
            <div className="disclaimer-warning" style={{ marginBottom: 'var(--space-4)', padding: 'var(--space-3) var(--space-4)' }}>
              <p style={{ fontSize: '0.85rem', color: 'var(--red)' }}>{error}</p>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'center', width: '100%', marginBottom: 'var(--space-5)' }}>
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={googleLoading}
              className="btn btn-secondary"
              style={{ width: '100%', maxWidth: 300, justifyContent: 'center', gap: 10 }}
            >
              <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              </svg>
              {googleLoading ? 'Redirecting To Google...' : 'Continue With Google'}
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-5)' }}>
            <div style={{ flex: 1, height: 1, background: 'rgba(168,180,192,0.2)' }} />
            <span style={{ fontSize: '0.75rem', color: 'var(--grey-500)' }}>Or Sign In With A Username</span>
            <div style={{ flex: 1, height: 1, background: 'rgba(168,180,192,0.2)' }} />
          </div>

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

            <div style={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
              <button
                type="submit"
                className="btn btn-primary stagger-fade-in stagger-3 hover-lift"
                style={{ width: '100%', maxWidth: 300, justifyContent: 'center' }}
                disabled={loading || !identifier || !password}
              >
                {loading ? 'Authenticating...' : 'Sign In To Laboratory'}
              </button>
            </div>
          </form>

          <div style={{
            marginTop: 'var(--space-6)',
            paddingTop: 'var(--space-6)',
            textAlign: 'center'
          }}>
            <p style={{ fontSize: '0.85rem', color: 'var(--grey-400)' }}>
              Don&apos;t Have An Account?{' '}
              <a href="/signup" style={{ color: 'var(--teal)' }}>Create Account</a>
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
