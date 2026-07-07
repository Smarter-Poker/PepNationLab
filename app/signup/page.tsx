'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { UserPlus } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { DEFAULT_STORE_SLUG } from '@/lib/default-store';

// Public Researcher Signup -- Every Account Created Here Is Linked To The
// House Storefront (Pep Nation Research Store) Via The Storefront Register API.

const ACKNOWLEDGMENTS = [
  { key: 'c1', text: 'I Confirm I Am At Least 21 Years Of Age And A Qualified Researcher Or Institutional Purchaser.' },
  { key: 'c2', text: 'I Confirm That All Products Are For In Vitro Laboratory Research Purposes Only And Will Not Be Used For Human Or Animal Consumption Or Injection.' },
  { key: 'c3', text: 'I Have Read And Accept The Terms Of Service, Privacy Policy, And Research-Only Compliance Requirements.' },
] as const;

type AckKey = (typeof ACKNOWLEDGMENTS)[number]['key'];

import { Suspense } from 'react';

function SignupForm() {
  const searchParams = useSearchParams();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [acks, setAcks] = useState<Record<AckKey, boolean>>({ c1: false, c2: false, c3: false });
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  // Two-step flow: 'form' collects details; 'code' collects the 6-digit email
  // verification code. When the email sender isn't configured, we skip 'code'
  // and create the account straight from the form.
  const [step, setStep] = useState<'form' | 'code'>('form');
  const [code, setCode] = useState('');
  const [resending, setResending] = useState(false);

  // Capture the agent slug from localStorage so the new account is linked
  // to the agent the guest was browsing when they decided to sign up.
  const [capturedAgentSlug, setCapturedAgentSlug] = useState<string | null>(null);
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem('pnl_referral_agent');
      if (stored) {
        const parsed = JSON.parse(stored) as { slug?: string; savedAt?: number };
        const age = Date.now() - (parsed.savedAt ?? 0);
        if (parsed.slug && age < 30 * 24 * 60 * 60 * 1000) {
          setCapturedAgentSlug(parsed.slug);
        }
      }
    } catch { /* ignore */ }
  }, []);

  // Sanitize ?redirect= - only allow relative paths starting with /
  const rawRedirect = searchParams.get('redirect') ?? '';
  const redirectTo = /^\/(?!\/|\\)/.test(rawRedirect) ? rawRedirect : '/dashboard';

  const allAcked = ACKNOWLEDGMENTS.every(a => acks[a.key]);

  async function logRegistrationDisclaimer() {
    try {
      await fetch('/api/disclaimer-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ layer: 'registration' }),
      });
    } catch {
      // Best Effort -- The Site Entry Gate Still Applies After Login.
    }
  }

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  // Step 1: validate the form, request an email verification code. If the email
  // sender isn't configured yet, skip straight to account creation.
  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    if (!allAcked) {
      setError('Please Confirm All Three Acknowledgments To Continue.');
      return;
    }
    if (!EMAIL_RE.test(email.trim())) {
      setError('Please Enter A Valid Email Address.');
      return;
    }
    setLoading(true);
    setError('');
    setInfo('');

    try {
      const res = await fetch('/api/auth/request-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data?.error || 'Could Not Start Verification. Please Try Again.');
        setLoading(false);
        return;
      }

      if (data?.verification_required) {
        // Move to the code-entry step.
        setStep('code');
        setInfo(`We Sent A 6-Digit Code To ${email.trim()}. Enter It Below To Finish.`);
        setLoading(false);
        return;
      }

      // Sender not configured -> create the account directly (email stored, unverified).
      await doRegister();
    } catch {
      setError('Something Went Wrong. Please Try Again.');
      setLoading(false);
    }
  }

  // Step 2: submit the code and create the account.
  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\d{6}$/.test(code.trim())) {
      setError('Enter The 6-Digit Code From Your Email.');
      return;
    }
    setLoading(true);
    setError('');
    await doRegister(code.trim());
  }

  async function handleResend() {
    if (resending) return;
    setResending(true);
    setError('');
    setInfo('');
    try {
      const res = await fetch('/api/auth/request-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setInfo(`A New Code Was Sent To ${email.trim()}.`);
      else setError(data?.error || 'Could Not Resend The Code.');
    } catch {
      setError('Could Not Resend The Code. Please Try Again.');
    } finally {
      setResending(false);
    }
  }

  // Creates the account (optionally with a verification code) and signs in.
  async function doRegister(verificationCode?: string) {
    setLoading(true);
    setError('');
    try {
      const agentSlug = capturedAgentSlug ?? DEFAULT_STORE_SLUG;

      const res = await fetch('/api/storefront/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentSlug,
          username,
          password,
          firstName,
          lastName,
          email: email.trim(),
          phone: phone || undefined,
          code: verificationCode,
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data?.error || 'Registration Failed. Please Try Again.');
        setLoading(false);
        return;
      }

      // Sign The New Researcher In Immediately.
      const supabase = createClient();
      const internalEmail = `${data.username}@internal.auth`;
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: internalEmail,
        password,
      });

      if (authError) {
        const loginFallback = `/login${redirectTo !== '/dashboard' ? `?redirect=${encodeURIComponent(redirectTo)}` : ''}`;
        window.location.replace(loginFallback);
        return;
      }

      await logRegistrationDisclaimer();
      try { window.localStorage.removeItem('pnl_referral_agent'); } catch { /* ignore */ }

      for (let i = 0; i < 15; i++) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) break;
        await new Promise(r => setTimeout(r, 200));
      }

      window.location.replace(redirectTo);
    } catch {
      setError('Something Went Wrong. Please Try Again.');
      setLoading(false);
    }
  }

  async function handleGoogleSignup() {
    if (googleLoading) return;
    if (!allAcked) {
      setError('Please Confirm All Three Acknowledgments Before Continuing With Google.');
      return;
    }
    setGoogleLoading(true);
    setError('');
    try {
      const supabase = createClient();
      // Pass redirect through the OAuth callback, plus registration ack flag
      const callbackRedirect = redirectTo !== '/dashboard'
        ? `${redirectTo}?ack=registration`
        : '/dashboard?ack=registration';

      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(callbackRedirect)}`,
        },
      });

      if (oauthError) {
        console.error('[Google Signup] OAuth Error:', oauthError);
        setError('Google Sign-In Is Not Available Right Now. Please Use The Form Below.');
        setGoogleLoading(false);
      } else if (!data?.url) {
        console.error('[Google Signup] No provider URL returned.');
        setError('Google Sign-In Is Not Available Right Now. Please Use The Form Below.');
        setGoogleLoading(false);
      }
      // If successful, redirect occurs automatically
    } catch (err) {
      console.error('[Google Signup] Unexpected Error:', err);
      setError('Google Sign-In Is Not Available Right Now. Please Use The Form Below.');
      setGoogleLoading(false);
    }
  }

  // Build the "Sign In" link so if the user switches to login, redirect is preserved
  const loginHref = redirectTo !== '/dashboard'
    ? `/login?redirect=${encodeURIComponent(redirectTo)}`
    : '/login';

  return (
    <div style={{
      minHeight: '100dvh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--black)',
      padding: 'var(--space-6)'
    }}>
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'radial-gradient(ellipse at 50% 0%, rgba(192,184,168,0.06) 0%, transparent 60%)',
        pointerEvents: 'none'
      }} />

      <div style={{ width: '100%', maxWidth: 460, position: 'relative' }}>
        <div className="glass-panel hover-lift stagger-fade-in" style={{ padding: 'var(--space-8)', boxShadow: '0 0 40px rgba(104,211,145,0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-2)' }}>
            <div style={{
              width: 40, height: 40, borderRadius: '50%',
              background: 'rgba(0,196,188,0.12)', border: '1px solid rgba(0,196,188,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--teal)', flexShrink: 0,
            }}>
              <UserPlus size={20} aria-hidden="true" />
            </div>
            <h2 className="animated-gradient-text" style={{ fontSize: '1.4rem' }}>Create Researcher Account</h2>
          </div>
          <p style={{ marginBottom: 'var(--space-6)', fontSize: '0.85rem', color: 'var(--grey-400)' }}>
            Join Pep Nation Lab For Peptide Education And Research
          </p>

          {capturedAgentSlug && (
            <div style={{
              marginBottom: 'var(--space-4)',
              padding: 'var(--space-2) var(--space-4)',
              background: 'rgba(0,196,188,0.07)',
              border: '1px solid rgba(0,196,188,0.2)',
              borderRadius: 8,
              fontSize: '0.78rem',
              color: 'var(--teal)',
            }}>
              ✓ Your account will be linked to your agent&apos;s storefront automatically.
            </div>
          )}

          {error && (
            <div className="disclaimer-warning" style={{ marginBottom: 'var(--space-4)', padding: 'var(--space-3) var(--space-4)' }}>
              <p style={{ fontSize: '0.85rem', color: 'var(--red)' }}>{error}</p>
            </div>
          )}

          {info && (
            <div style={{ marginBottom: 'var(--space-4)', padding: 'var(--space-3) var(--space-4)', background: 'rgba(0,196,188,0.08)', border: '1px solid rgba(0,196,188,0.25)', borderRadius: 8 }}>
              <p style={{ fontSize: '0.82rem', color: 'var(--teal)', margin: 0 }}>{info}</p>
            </div>
          )}

          {/* ── Step 2: Email verification code ── */}
          {step === 'code' && (
            <form onSubmit={handleVerify}>
              <div className="form-group">
                <label className="form-label" htmlFor="code">6-Digit Verification Code</label>
                <input
                  id="code" type="text" inputMode="numeric" className="form-input"
                  placeholder="000000" value={code}
                  onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  autoComplete="one-time-code" autoFocus
                  style={{ letterSpacing: '0.4em', fontSize: '1.2rem', textAlign: 'center' }}
                />
              </div>
              <button
                type="submit"
                className="btn btn-primary hover-lift"
                style={{ width: '100%', justifyContent: 'center' }}
                disabled={loading || code.length !== 6}
              >
                {loading ? 'Verifying...' : 'Verify & Create Account'}
              </button>
              <div style={{ marginTop: 'var(--space-4)', display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                <button type="button" onClick={() => { setStep('form'); setError(''); setInfo(''); setCode(''); }}
                  style={{ background: 'none', border: 'none', color: 'var(--grey-400)', cursor: 'pointer', padding: 0 }}>
                  Use A Different Email
                </button>
                <button type="button" onClick={handleResend} disabled={resending}
                  style={{ background: 'none', border: 'none', color: 'var(--teal)', cursor: 'pointer', padding: 0 }}>
                  {resending ? 'Resending...' : 'Resend Code'}
                </button>
              </div>
            </form>
          )}

          {step === 'form' && (
          <>
          <button
            type="button"
            onClick={handleGoogleSignup}
            disabled={googleLoading}
            className="btn btn-secondary"
            style={{ width: '100%', justifyContent: 'center', gap: 10, marginBottom: 'var(--space-5)' }}
          >
            <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
            </svg>
            {googleLoading ? 'Redirecting To Google...' : 'Continue With Google'}
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-5)' }}>
            <div style={{ flex: 1, height: 1, background: 'rgba(168,180,192,0.2)' }} />
            <span style={{ fontSize: '0.75rem', color: 'var(--grey-500)' }}>Or Sign Up With A Username</span>
            <div style={{ flex: 1, height: 1, background: 'rgba(168,180,192,0.2)' }} />
          </div>

          <form onSubmit={handleSignup}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
              <div className="form-group">
                <label className="form-label" htmlFor="firstName">First Name</label>
                <input
                  id="firstName" type="text" className="form-input" placeholder="First Name"
                  value={firstName} onChange={e => setFirstName(e.target.value)}
                  required maxLength={100} autoComplete="given-name"
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="lastName">Last Name</label>
                <input
                  id="lastName" type="text" className="form-input" placeholder="Last Name"
                  value={lastName} onChange={e => setLastName(e.target.value)}
                  required maxLength={100} autoComplete="family-name"
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="username">Username</label>
              <input
                id="username" type="text" className="form-input" placeholder="Choose A Username"
                value={username} onChange={e => setUsername(e.target.value)}
                required minLength={2} maxLength={30}
                autoComplete="username" autoCapitalize="none" spellCheck={false}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="email">Email</label>
              <input
                id="email" type="email" className="form-input" placeholder="you@example.com"
                value={email} onChange={e => setEmail(e.target.value)}
                required maxLength={254} autoComplete="email" autoCapitalize="none" spellCheck={false}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="password">Password</label>
              <input
                id="password" type="password" className="form-input" placeholder="At Least 8 Characters"
                value={password} onChange={e => setPassword(e.target.value)}
                required minLength={8} maxLength={128} autoComplete="new-password"
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="phone">Phone (Optional)</label>
              <input
                id="phone" type="tel" className="form-input" placeholder="Phone Number"
                value={phone} onChange={e => setPhone(e.target.value)}
                maxLength={30} autoComplete="tel"
              />
            </div>

            <div style={{ margin: 'var(--space-5) 0', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {ACKNOWLEDGMENTS.map(a => (
                <label key={a.key} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={acks[a.key]}
                    onChange={e => setAcks(prev => ({ ...prev, [a.key]: e.target.checked }))}
                    style={{ marginTop: 3, accentColor: 'var(--teal)', flexShrink: 0 }}
                  />
                  <span style={{ fontSize: '0.78rem', color: 'var(--grey-300)', lineHeight: 1.5 }}>{a.text}</span>
                </label>
              ))}
            </div>

            <button
              type="submit"
              className="btn btn-primary hover-lift"
              style={{ width: '100%', justifyContent: 'center' }}
              disabled={loading || !allAcked || !firstName || !lastName || !username || !email || password.length < 8}
            >
              {loading ? 'Creating Account...' : 'Create Account'}
            </button>
          </form>
          </>
          )}

          <div style={{ marginTop: 'var(--space-6)', textAlign: 'center' }}>
            <p style={{ fontSize: '0.85rem', color: 'var(--grey-400)' }}>
              Already Have An Account?{' '}
              <a href={loginHref} style={{ color: 'var(--teal)' }}>Sign In</a>
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

export default function SignupPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div className="spinner"></div></div>}>
      <SignupForm />
    </Suspense>
  );
}
