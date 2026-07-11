'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Key, ArrowRight, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';

// Code-based password reset (two steps):
//   Step 1: enter the verified contact email -> a 6-digit code is emailed.
//   Step 2: enter the code + a new password -> the password is reset.
// The auth identity is a synthetic <username>@internal.auth address, so a
// magic-link reset cannot reach the researcher; a code to their real, verified
// contact email does.

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<'email' | 'code' | 'done'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resending, setResending] = useState(false);

  async function requestCode(): Promise<boolean> {
    const res = await fetch('/api/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data?.error || 'Failed To Send Reset Code.');
      return false;
    }
    return true;
  }

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    setError(null);
    try {
      // Enumeration-safe: the endpoint always returns success, so we always
      // advance to the code step.
      const ok = await requestCode();
      if (ok) setStep('code');
    } catch {
      setError('An Unexpected Error Occurred.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resending) return;
    setResending(true);
    setError(null);
    try { await requestCode(); } catch { /* ignore */ } finally { setResending(false); }
  };

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(code.trim())) { setError('Enter The 6-Digit Code From Your Email.'); return; }
    if (newPassword.length < 8) { setError('Password Must Be At Least 8 Characters.'); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/reset-password/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: code.trim(), newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data?.error || 'Could Not Reset Password.'); return; }
      setStep('done');
    } catch {
      setError('An Unexpected Error Occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--black)', padding: 'var(--space-6)' }}>
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'radial-gradient(ellipse at 50% 0%, rgba(192,184,168,0.06) 0%, transparent 60%)', pointerEvents: 'none' }} />

      <div style={{ width: '100%', maxWidth: 440, position: 'relative' }}>
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-8)' }}>
          <Link href="/" style={{ display: 'inline-block' }} aria-label="Pep Nation Lab Home">
            <Image src="/logo.svg" alt="Pep Nation Lab" width={108} height={108} unoptimized style={{ height: 108, width: 'auto', display: 'inline-block' }} />
          </Link>
          <p style={{ marginTop: 'var(--space-2)', fontSize: '0.85rem', color: 'var(--grey-400)' }}>Reset Your Password</p>
        </div>

        <div className="glass-panel hover-lift stagger-fade-in" style={{ padding: 'var(--space-8)', boxShadow: '0 0 40px rgba(104,211,145,0.05)' }}>
          <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(192,184,168,0.12)', border: '1px solid rgba(192,184,168,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto var(--space-4)', color: 'var(--teal)' }}>
            <Key size={22} aria-hidden="true" />
          </div>
          <h2 className="animated-gradient-text" style={{ fontSize: '1.2rem', marginBottom: 'var(--space-2)', textAlign: 'center' }}>Password Reset</h2>

          {error && (
            <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3)', margin: 'var(--space-4) 0', display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)' }}>
              <AlertTriangle size={18} style={{ color: 'var(--red)', flexShrink: 0, marginTop: 2 }} />
              <p style={{ fontSize: '0.85rem', color: 'var(--red)', lineHeight: 1.5, margin: 0 }}>{error}</p>
            </div>
          )}

          {step === 'done' ? (
            <div style={{ textAlign: 'center', margin: 'var(--space-6) 0' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 'var(--space-4)', color: 'var(--teal)' }}>
                <CheckCircle2 size={48} />
              </div>
              <p style={{ fontSize: '0.95rem', color: 'var(--white)', marginBottom: 'var(--space-2)', fontWeight: 600 }}>Password Updated</p>
              <p style={{ fontSize: '0.85rem', color: 'var(--silver)', lineHeight: 1.6 }}>Your Password Has Been Reset. You Can Now Sign In With Your New Password.</p>
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: 'var(--space-6)' }}>
                <Link href="/login" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>Return To Sign In</Link>
              </div>
            </div>
          ) : step === 'email' ? (
            <>
              <p style={{ fontSize: '0.9rem', color: 'var(--grey-300)', lineHeight: 1.6, textAlign: 'center', marginBottom: 'var(--space-6)' }}>
                Enter The Email Address On Your Account To Receive A 6-Digit Reset Code.
              </p>
              <form onSubmit={handleRequest}>
                <div style={{ marginBottom: 'var(--space-6)' }}>
                  <label htmlFor="email" style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--grey-300)', marginBottom: 'var(--space-2)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Email Address</label>
                  <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="form-input" placeholder="Enter Your Email" style={{ width: '100%' }} autoFocus autoComplete="email" autoCapitalize="none" spellCheck={false} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                  <button type="submit" disabled={loading} className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                    {loading ? (<><Loader2 size={18} className="spin" style={{ marginRight: '0.5rem' }} />Sending...</>) : (<>Send Reset Code<ArrowRight size={18} style={{ marginLeft: '0.5rem' }} /></>)}
                  </button>
                  <Link href="/login" className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center' }}>Cancel</Link>
                </div>
              </form>
            </>
          ) : (
            <>
              <p style={{ fontSize: '0.9rem', color: 'var(--grey-300)', lineHeight: 1.6, textAlign: 'center', marginBottom: 'var(--space-6)' }}>
                If An Account Exists For {email}, A 6-Digit Code Was Sent. Enter It Below With Your New Password.
              </p>
              <form onSubmit={handleConfirm}>
                <div style={{ marginBottom: 'var(--space-4)' }}>
                  <label htmlFor="code" style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--grey-300)', marginBottom: 'var(--space-2)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Reset Code</label>
                  <input id="code" type="text" inputMode="numeric" required value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} className="form-input" placeholder="000000" style={{ width: '100%', letterSpacing: '0.4em', textAlign: 'center', fontSize: '1.2rem' }} autoFocus autoComplete="one-time-code" />
                </div>
                <div style={{ marginBottom: 'var(--space-6)' }}>
                  <label htmlFor="newPassword" style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--grey-300)', marginBottom: 'var(--space-2)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>New Password</label>
                  <input id="newPassword" type="password" required minLength={8} maxLength={128} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="form-input" placeholder="At Least 8 Characters" style={{ width: '100%' }} autoComplete="new-password" />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                  <button type="submit" disabled={loading || code.length !== 6 || newPassword.length < 8} className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                    {loading ? (<><Loader2 size={18} className="spin" style={{ marginRight: '0.5rem' }} />Resetting...</>) : 'Reset Password'}
                  </button>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                    <button type="button" onClick={() => { setStep('email'); setError(null); setCode(''); setNewPassword(''); }} style={{ background: 'none', border: 'none', color: 'var(--grey-400)', cursor: 'pointer', padding: 0 }}>Use A Different Email</button>
                    <button type="button" onClick={handleResend} disabled={resending} style={{ background: 'none', border: 'none', color: 'var(--teal)', cursor: 'pointer', padding: 0 }}>{resending ? 'Resending...' : 'Resend Code'}</button>
                  </div>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
