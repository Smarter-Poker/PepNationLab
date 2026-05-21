'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!email.trim()) {
      setError('Please Enter Your Email Address.');
      return;
    }

    setLoading(true);
    const supabase = createClient();

    const redirectTo =
      typeof window !== 'undefined' ? `${window.location.origin}/login` : undefined;

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(
      email.trim(),
      redirectTo ? { redirectTo } : undefined
    );

    setLoading(false);

    if (resetError) {
      setError(resetError.message);
      return;
    }

    // Always show success — do not reveal whether an account exists.
    setSent(true);
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--black)',
        padding: 'var(--space-6)',
      }}
    >
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'radial-gradient(ellipse at 50% 0%, rgba(0,196,188,0.06) 0%, transparent 60%)',
          pointerEvents: 'none',
        }}
      />

      <div style={{ width: '100%', maxWidth: 440, position: 'relative' }}>
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-8)' }}>
          <Link href="/" style={{ display: 'inline-block' }} aria-label="Pep Nation Lab Home">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.svg" alt="Pep Nation Lab" style={{ height: 108, width: 'auto', display: 'inline-block' }} />
          </Link>
          <p style={{ marginTop: 'var(--space-2)', fontSize: '0.85rem', color: 'var(--grey-400)' }}>
            Reset Your Password
          </p>
        </div>

        <div className="card-metal" style={{ padding: 'var(--space-8)' }}>
          {sent ? (
            <div style={{ textAlign: 'center' }}>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  background: 'rgba(0,196,188,0.1)',
                  border: '2px solid var(--teal)',
                  color: 'var(--teal)',
                  marginBottom: 'var(--space-4)',
                }}
              >
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                  <polyline points="22,6 12,13 2,6" />
                </svg>
              </div>
              <h2 style={{ fontSize: '1.2rem', marginBottom: 'var(--space-3)' }}>Check Your Email</h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--silver)', lineHeight: 1.7, marginBottom: 'var(--space-6)' }}>
                If An Account Exists For <strong style={{ color: 'var(--white)' }}>{email.trim()}</strong>,
                A Password Reset Link Has Been Sent. Please Check Your Inbox And Spam Folder.
              </p>
              <Link href="/login" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                Return To Sign In
              </Link>
            </div>
          ) : (
            <>
              <h2 style={{ fontSize: '1.2rem', marginBottom: 'var(--space-2)' }}>Forgot Your Password?</h2>
              <p style={{ fontSize: '0.83rem', color: 'var(--grey-400)', marginBottom: 'var(--space-6)', lineHeight: 1.6 }}>
                Enter The Email Address On Your Account And We Will Send You A Link To Reset Your
                Password.
              </p>

              {error && (
                <div className="disclaimer-warning" style={{ marginBottom: 'var(--space-4)', padding: 'var(--space-3) var(--space-4)' }}>
                  <p style={{ fontSize: '0.85rem', color: 'var(--red)', margin: 0 }}>{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit}>
                <div className="form-group">
                  <label className="form-label" htmlFor="reset-email">Email Address</label>
                  <input
                    id="reset-email"
                    type="email"
                    className="form-input"
                    placeholder="researcher@lab.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={loading}
                  style={{ width: '100%', justifyContent: 'center', marginTop: 'var(--space-2)', opacity: loading ? 0.7 : 1 }}
                >
                  {loading ? 'Sending Reset Link...' : 'Send Reset Link'}
                </button>
              </form>

              <p style={{ textAlign: 'center', marginTop: 'var(--space-6)', fontSize: '0.8rem', color: 'var(--grey-400)' }}>
                Remembered It?{' '}
                <Link href="/login" style={{ color: 'var(--teal)' }}>Sign In</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
