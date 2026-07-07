'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Key, ArrowRight, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = createClient();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // We rely on Supabase client automatically picking up the session from the #access_token in the URL.
  // We can just verify the user is logged in, but we don't strictly have to wait for it before showing the form.
  useEffect(() => {
    supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        console.log('Recovery session detected.');
      }
    });
  }, [supabase.auth]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('Passwords Do Not Match.');
      return;
    }
    if (password.length < 8) {
      setError('Password Must Be At Least 8 Characters.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      });

      if (updateError) {
        throw new Error(updateError.message);
      }

      setSuccess(true);
      setTimeout(() => {
        router.push('/dashboard');
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'An Unexpected Error Occurred.');
    } finally {
      setLoading(false);
    }
  };

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
            Choose A New Password
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
          <h2 className="animated-gradient-text" style={{ fontSize: '1.2rem', marginBottom: 'var(--space-2)', textAlign: 'center' }}>New Password</h2>
          
          {success ? (
            <div style={{ textAlign: 'center', margin: 'var(--space-6) 0' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 'var(--space-4)', color: 'var(--teal)' }}>
                <CheckCircle2 size={48} />
              </div>
              <p style={{ fontSize: '0.95rem', color: 'var(--white)', marginBottom: 'var(--space-2)', fontWeight: 600 }}>
                Password Updated Successfully
              </p>
              <p style={{ fontSize: '0.85rem', color: 'var(--silver)', lineHeight: 1.6 }}>
                Taking You To Your Dashboard...
              </p>
            </div>
          ) : (
            <>
              <p style={{ fontSize: '0.9rem', color: 'var(--grey-300)', lineHeight: 1.6, textAlign: 'center', marginBottom: 'var(--space-6)' }}>
                Enter Your New Password Below.
              </p>

              {error && (
                <div style={{
                  background: 'rgba(239,68,68,0.1)',
                  border: '1px solid rgba(239,68,68,0.2)',
                  borderRadius: 'var(--radius-md)',
                  padding: 'var(--space-3)',
                  marginBottom: 'var(--space-5)',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 'var(--space-3)'
                }}>
                  <AlertTriangle size={18} style={{ color: 'var(--red)', flexShrink: 0, marginTop: 2 }} />
                  <p style={{ fontSize: '0.85rem', color: 'var(--red)', lineHeight: 1.5, margin: 0 }}>{error}</p>
                </div>
              )}

              <form onSubmit={handleSubmit}>
                <div style={{ marginBottom: 'var(--space-4)' }}>
                  <label htmlFor="password" style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--grey-300)', marginBottom: 'var(--space-2)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    New Password
                  </label>
                  <input
                    id="password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="form-input"
                    placeholder="At least 8 characters"
                    style={{ width: '100%' }}
                    autoFocus
                  />
                </div>

                <div style={{ marginBottom: 'var(--space-6)' }}>
                  <label htmlFor="confirmPassword" style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--grey-300)', marginBottom: 'var(--space-2)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Confirm Password
                  </label>
                  <input
                    id="confirmPassword"
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="form-input"
                    placeholder="Must match"
                    style={{ width: '100%' }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                  <button type="submit" disabled={loading} className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                    {loading ? (
                      <>
                        <Loader2 size={18} className="spin" style={{ marginRight: '0.5rem' }} />
                        Saving...
                      </>
                    ) : (
                      <>
                        Update Password
                        <ArrowRight size={18} style={{ marginLeft: '0.5rem' }} />
                      </>
                    )}
                  </button>
                  <Link href="/login" className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center' }}>
                    Cancel
                  </Link>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
