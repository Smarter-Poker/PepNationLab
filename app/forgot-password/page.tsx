'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Key } from 'lucide-react';
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

    // Always show success - do not reveal whether an account exists.
    setSent(true);
  }

  return (
    <div
      style={{
        minHeight: '100dvh',
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
          background: 'radial-gradient(ellipse at 50% 0%, rgba(192,184,168,0.06) 0%, transparent 60%)',
          pointerEvents: 'none',
        }}
      />

      <div style={{ width: '100%', maxWidth: 440, position: 'relative' }}>
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-8)' }}>
          <Link href="/" style={{ display: 'inline-block' }} aria-label="Pep Nation Lab Home">
            <Image src="/logo.svg" alt="Pep Nation Lab" width={108} height={108} unoptimized style={{ height: 108, width: 'auto', display: 'inline-block' }} />
          </Link>
          <p style={{ marginTop: 'var(--space-2)', fontSize: '0.85rem', color: 'var(--grey-400)' }}>
            Reset Your Password
          </p>
        </div>

        <div className="glass-panel hover-lift stagger-fade-in" style={{ padding: 'var(--space-8)', boxShadow: '0 0 40px rgba(104,211,145,0.05)' }}>
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
                  background: 'rgba(192,184,168,0.1)',
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
              <h2 className="animated-gradient-text" style={{ fontSize: '1.2rem', marginBottom: 'var(--space-3)' }}>Check Your Email</h2>
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
              <h2 className="animated-gradient-text" style={{ fontSize: '1.2rem', marginBottom: 'var(--space-2)', textAlign: 'center' }}>Password Reset</h2>
              <p style={{ fontSize: '0.9rem', color: 'var(--grey-300)', lineHeight: 1.6, textAlign: 'center', marginBottom: 'var(--space-6)' }}>
                Please contact your Research Agent directly if you forgot your password or need it reset.
              </p>

              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <Link href="/login" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                  Return To Sign In
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
