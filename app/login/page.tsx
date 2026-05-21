'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    router.push('/dashboard');
    router.refresh();
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
      {/* Background glow */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'radial-gradient(ellipse at 50% 0%, rgba(0,196,188,0.06) 0%, transparent 60%)',
        pointerEvents: 'none'
      }} />

      <div style={{ width: '100%', maxWidth: 420, position: 'relative' }}>
        {/* Logo / Brand */}
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-8)' }}>
          <Link href="/" style={{
            fontFamily: 'var(--font-brand)',
            fontSize: '1.1rem',
            fontWeight: 800,
            letterSpacing: '0.12em',
            color: 'var(--teal)',
            textShadow: '0 0 20px rgba(0,196,188,0.4)'
          }}>
            PEP NATION LAB
          </Link>
          <p style={{ marginTop: 'var(--space-2)', fontSize: '0.85rem', color: 'var(--grey-400)' }}>
            Researcher Portal
          </p>
        </div>

        {/* Card */}
        <div className="card-metal" style={{ padding: 'var(--space-8)' }}>
          <h2 style={{ marginBottom: 'var(--space-2)', fontSize: '1.4rem' }}>Sign In</h2>
          <p style={{ marginBottom: 'var(--space-6)', fontSize: '0.85rem', color: 'var(--grey-400)' }}>
            Access Your Researcher Account
          </p>

          {error && (
            <div className="disclaimer-warning" style={{ marginBottom: 'var(--space-4)', padding: 'var(--space-3) var(--space-4)' }}>
              <p style={{ fontSize: '0.85rem', color: 'var(--red)' }}>{error}</p>
            </div>
          )}

          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label className="form-label" htmlFor="email">Email Address</label>
              <input
                id="email"
                type="email"
                className="form-input"
                placeholder="researcher@lab.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
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

            <div style={{ textAlign: 'right', marginBottom: 'var(--space-6)', marginTop: '-var(--space-2)' }}>
              <Link href="/forgot-password" style={{ fontSize: '0.8rem', color: 'var(--teal)' }}>
                Forgot Password?
              </Link>
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
            <p style={{ fontSize: '0.85rem', color: 'var(--grey-400)' }}>
              Don&apos;t Have An Account?{' '}
              <Link href="/register" style={{ color: 'var(--teal)', fontWeight: 600 }}>
                Create Researcher Account
              </Link>
            </p>
          </div>
        </div>

        {/* Research-only reminder */}
        <p style={{
          marginTop: 'var(--space-4)',
          textAlign: 'center',
          fontSize: '0.75rem',
          color: 'var(--grey-600)'
        }}>
          For Qualified Researchers Only. Research Use Only.
        </p>
      </div>
    </div>
  );
}
