'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Key } from 'lucide-react';

export default function ForgotPasswordPage() {
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
                Please Contact Your Research Agent Directly If You Forgot Your Password Or Need It Reset.
              </p>

              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <Link href="/login" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                  Return To Sign In
                </Link>
              </div>
        </div>
      </div>
    </div>
  );
}
