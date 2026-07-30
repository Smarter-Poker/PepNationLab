'use client';

import { z } from 'zod';
import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { UserPlus } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { DEFAULT_STORE_SLUG } from '@/lib/default-store';
// REF_LOCK_MAX_AGE is the ONE definition of how long a referral attribution
// survives. It is imported rather than re-typed because this file previously
// re-declared the number and drifted to a third of the real value -- see the
// comment on the age check inside the localStorage capture below.
import { REF_LOCK_MAX_AGE } from '@/lib/ref-lock';
import { buildOAuthCallbackUrl } from '@/lib/oauth-callback-url';
import { useAvailability, availabilityMessage } from '@/lib/useAvailability';

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
  const router = useRouter();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [referralInput, setReferralInput] = useState('');
  const [promoInput, setPromoInput] = useState('');
  const [acks, setAcks] = useState<Record<AckKey, boolean>>({ c1: false, c2: false, c3: false });
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showGoogleModal, setShowGoogleModal] = useState(false);
  // Step 2 of the Google modal: agent referral capture
  const [showAgentRefStep, setShowAgentRefStep] = useState(false);
  const [googleReferralInput, setGoogleReferralInput] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  // Two-step flow: 'form' collects details; 'code' collects the 6-digit email
  // verification code. When the email sender isn't configured, we skip 'code'
  // and create the account straight from the form.
  const [step, setStep] = useState<'form' | 'code'>('form');
  const [code, setCode] = useState('');
  const [resending, setResending] = useState(false);

  const [usernameDirty, setUsernameDirty] = useState(false);

  const usernameCheck = useAvailability({
    field: 'username',
    value: username,
    minLength: 2,
    disabled: false,
  });
  const usernameMsg = availabilityMessage(usernameCheck);
  const usernameBlocked =
    usernameCheck.status === 'taken' ||
    usernameCheck.status === 'reserved' ||
    usernameCheck.status === 'invalid';

  // Capture the agent slug from localStorage so the new account is linked
  // to the agent the guest was browsing when they decided to sign up.
  const [capturedAgentSlug, setCapturedAgentSlug] = useState<string | null>(null);
  const [capturedSubAgentId, setCapturedSubAgentId] = useState<string | null>(null);
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem('pnl_referral_agent');
      if (stored) {
        const parsed = JSON.parse(stored) as { slug?: string; sa?: string; savedAt?: number };
        const age = Date.now() - (parsed.savedAt ?? 0);
        // Attribution lifetime is ONE number, and it lives in lib/ref-lock.ts.
        // This test was a hardcoded 30 days while both the signed cookie lock
        // (REF_LOCK_MAX_AGE) and the component that WROTE this entry
        // (MAX_AGE_MS in components/AgentLinkCapture.tsx) used 90. A guest who
        // scanned an agent's QR and came back to sign up on day 31-90 therefore
        // arrived with a capture that was still live everywhere else and was
        // silently discarded here: agentSlug fell through to
        // DEFAULT_STORE_SLUG and the HOUSE store was credited for that agent's
        // signup, with nothing logged and nothing for the agent to dispute.
        // Re-declaring the literal is exactly what let the three drift apart,
        // so the constant is imported instead of restated.
        if (parsed.slug && age < REF_LOCK_MAX_AGE * 1000) {
          // The house storefront is the default destination anyway - a stored
          // house slug carries no referral information, and treating it as a
          // capture would silently SKIP the "Who Referred You?" step for
          // anyone who ever browsed the house store. Only NAMED agents count.
          if (parsed.slug !== DEFAULT_STORE_SLUG) setCapturedAgentSlug(parsed.slug);
          if (parsed.sa && /^[0-9a-f-]{36}$/i.test(parsed.sa)) setCapturedSubAgentId(parsed.sa);
        }
      }
    } catch { /* ignore */ }
  }, []);

  // Sanitize ?redirect= - only allow relative paths starting with /
  const rawRedirect = searchParams.get('redirect') ?? '';
  const redirectTo = /^\/(?!\/|\\)/.test(rawRedirect) ? rawRedirect : '/dashboard';

  // Capture ?ref= from the URL. When present, the referral is LOCKED — the
  // field is pre-filled and read-only so the agent attribution cannot be
  // removed or changed by the person signing up.
  const [lockedRef, setLockedRef] = useState<string | null>(null);
  useEffect(() => {
    let rawRef = (searchParams.get('ref') ?? '').trim();
    if (!rawRef || !/^[A-Za-z0-9_-]{2,50}$/.test(rawRef)) {
      // No valid ?ref= — fall back to the QR lock display cookie
      // (pnl_ref_display, set by the middleware alongside the signed lock) so
      // the locked referral still shows when /signup is reached without the
      // query param. The signed httpOnly cookie remains the server-side truth.
      //
      // This branch is now the ONLY display source for a scanned guest, not a
      // spare one. proxy.ts redirects any GET carrying ?ref= on an
      // account-entry path (ACCOUNT_ENTRY_PREFIXES) back to the locked
      // storefront, so a locked guest can never reach this form with the query
      // param still attached -- which is why the landing page's "Create
      // Account" link emits a bare /signup. Without the cookie read the
      // "Referred By (Locked)" field would render EMPTY for precisely the
      // visitors whose referrer is most certain.
      //
      // There is deliberately no further fallback to the pnl_referral_agent
      // localStorage capture read above: that entry stores a storefront SLUG,
      // and slugs and referral codes are separate namespaces (the store
      // `scooters` is owned by username `adam`, while a different agent owns
      // the store `adam`), so rendering one as the other would name the wrong
      // person as the referrer. Nothing here is trusted for credit in any
      // case -- the server awards it from the signed httpOnly lock alone.
      try {
        const m = document.cookie.match(/(?:^|;\s*)pnl_ref_display=([^;]*)/);
        if (m) rawRef = decodeURIComponent(m[1]).trim();
      } catch { /* ignore */ }
    }
    if (rawRef && /^[A-Za-z0-9_-]{2,50}$/.test(rawRef)) {
      setReferralInput(rawRef);
      setLockedRef(rawRef); // lock it — cannot be changed
    }
    const rawPromo = (searchParams.get('promo') ?? '').trim();
    if (rawPromo && /^[A-Za-z0-9_-]{2,40}$/.test(rawPromo)) setPromoInput(rawPromo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          referralCode: referralInput.trim() || undefined,
          promoCode: promoInput.trim() || undefined,
          subAgentId: capturedSubAgentId ?? undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data?.error || 'Registration Failed. Please Try Again.');
        setLoading(false);
        return;
      }

      // Surface a soft note if the promo code could not be applied (signup still
      // succeeded). A successful reward is confirmed on the dashboard.
      if (data?.promoWarning) {
        try { sessionStorage.setItem('pnl_signup_promo_warning', String(data.promoWarning)); } catch { /* ignore */ }
      } else if (data?.promo?.redeemed) {
        try { sessionStorage.setItem('pnl_signup_promo_success', JSON.stringify(data.promo)); } catch { /* ignore */ }
      }

      // Sign The New Researcher In Immediately.
      // We retry up to 3 times to account for potential Supabase Auth read replica replication lag.
      // Schema check: `username` is interpolated into the internal auth email,
      // so it must be the sanitized string the server reports -- never an
      // arbitrary value off an untyped response.
      const usernameParsed = z.object({ username: z.string().regex(/^[a-z0-9_]{2,100}$/i) }).safeParse(data);
      if (!usernameParsed.success) {
        setError('Account Created. Please Sign In With Your Username And Password.');
        setLoading(false);
        return;
      }
      const supabase = createClient();
      const internalEmail = `${usernameParsed.data.username}@internal.auth`;
      let authError = null;
      
      for (let i = 0; i < 3; i++) {
        const { error } = await supabase.auth.signInWithPassword({
          email: internalEmail,
          password,
        });
        authError = error;
        if (!error) break;
        await new Promise(r => setTimeout(r, 500));
      }

      if (authError) {
        setError(`Auto-login failed: ${authError.message}. Please click 'Sign In' at the top right to log in manually.`);
        setLoading(false);
        return;
      }

      await logRegistrationDisclaimer();
      try { window.localStorage.removeItem('pnl_referral_agent'); } catch { /* ignore */ }

      for (let i = 0; i < 15; i++) {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) break;
        await new Promise(r => setTimeout(r, 200));
      }

      // Allow Supabase read replicas 1.5s to sync before server-side redirect
      await new Promise(r => setTimeout(r, 1500));
      router.refresh();
      router.push(redirectTo);
    } catch {
      setError('Something Went Wrong. Please Try Again.');
      setLoading(false);
    }
  }

  async function proceedWithGoogle(agentSlug?: string) {
    setGoogleLoading(true);
    setError('');
    setShowGoogleModal(false);
    setShowAgentRefStep(false);
    try {
      const supabase = createClient();
      // The callback URL contract (redirect + ack + agentRef + subAgentRef as
      // TOP-LEVEL params - never nested inside redirect) lives in
      // lib/oauth-callback-url.ts and is round-trip tested. If we know the
      // referring agent, their slug rides along so the server can link the new
      // researcher after Google returns; the QR sub-agent capture is only
      // forwarded when the agent being linked is the captured one.
      const resolvedAgent = agentSlug ?? capturedAgentSlug ?? null;
      const callbackUrl = buildOAuthCallbackUrl({
        origin: window.location.origin,
        redirect: redirectTo,
        ack: 'registration',
        agentRef: resolvedAgent,
        subAgentRef:
          resolvedAgent && resolvedAgent === capturedAgentSlug ? capturedSubAgentId : null,
      });

      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: callbackUrl,
          // Force Google to show the account chooser instead of silently
          // reusing the last authorized account.
          queryParams: { prompt: 'select_account' },
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

  function handleGoogleSignup() {
    if (googleLoading) return;
    if (!allAcked) {
      // Show the acknowledgment modal (Step 1)
      setShowGoogleModal(true);
      setShowAgentRefStep(false);
      return;
    }
    // Acks already checked — go straight to referral step (or skip if agent is known)
    if (capturedAgentSlug) {
      // Agent already captured from QR code scan — skip referral step entirely
      proceedWithGoogle(capturedAgentSlug);
    } else {
      // Pre-fill googleReferralInput from ?ref= URL param if present
      if (referralInput && !googleReferralInput) setGoogleReferralInput(referralInput);
      setShowGoogleModal(true);
      setShowAgentRefStep(true);
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
        <div className="glass-panel hover-lift stagger-fade-in" style={{ padding: 'var(--space-8)', border: '4px solid var(--silver-dark)', borderRadius: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-2)' }}>
            <div style={{
              width: 40, height: 40, borderRadius: '50%',
              background: 'rgba(0,196,188,0.12)', border: '1px solid rgba(0,196,188,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--teal)', flexShrink: 0,
            }}>
              <UserPlus size={20} aria-hidden="true" />
            </div>
            <h1 className="animated-gradient-text" style={{ fontSize: '1.4rem', textAlign: 'center' }}>Create Researcher Account</h1>
          </div>
          <p style={{ marginBottom: 'var(--space-6)', fontSize: '0.85rem', color: 'var(--grey-400)', textAlign: 'center' }}>
            Join Pep Nation Lab For Peptide Education And Research
          </p>



          {error && (
            <div role="alert" className="disclaimer-warning" style={{ marginBottom: 'var(--space-4)', padding: 'var(--space-3) var(--space-4)' }}>
              <p style={{ fontSize: '0.85rem', color: 'var(--red)' }}>{error}</p>
            </div>
          )}

          {info && (
            <div role="status" style={{ marginBottom: 'var(--space-4)', padding: 'var(--space-4)', background: 'rgba(255,255,255,0.02)', border: '2px solid var(--silver-dark)', borderRadius: 8 }}>
              <p style={{ fontSize: '0.9rem', color: 'var(--silver-light)', margin: 0, textAlign: 'center', lineHeight: 1.5 }}>{info}</p>
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
              <div style={{ display: 'flex', justifyContent: 'center', width: '100%', marginTop: '40px' }}>
                <button
                  type="submit"
                  className="btn btn-primary hover-lift"
                  style={{ width: '100%', maxWidth: 300, display: 'flex', justifyContent: 'center', textAlign: 'center' }}
                  disabled={loading || code.length !== 6}
                >
                  {loading ? 'Verifying...' : 'Verify & Create Account'}
                </button>
              </div>
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
          <div style={{ display: 'flex', justifyContent: 'center', width: '100%', marginBottom: 'var(--space-5)' }}>
            <button
              type="button"
              onClick={handleGoogleSignup}
              disabled={googleLoading}
              className="btn btn-secondary"
              style={{ width: '100%', maxWidth: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}
            >
              <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true" style={{ flexShrink: 0 }}>
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              </svg>
              <span style={{ fontWeight: 600 }}>{googleLoading ? 'Redirecting To Google...' : 'Continue With Google'}</span>
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-5)' }}>
            <div style={{ flex: 1, height: 1, background: 'rgba(168,180,192,0.2)' }} />
            <span style={{ fontSize: '0.75rem', color: 'var(--grey-500)' }}>Or Sign Up With A Username</span>
            <div style={{ flex: 1, height: 1, background: 'rgba(168,180,192,0.2)' }} />
          </div>

          <form onSubmit={handleSignup}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
              <div className="form-group" style={{ marginTop: 0 }}>
                <label className="form-label" htmlFor="firstName">First Name</label>
                <input
                  id="firstName" type="text" className="form-input" placeholder="First Name"
                  value={firstName} onChange={e => setFirstName(e.target.value)}
                  required maxLength={100} autoComplete="given-name"
                />
              </div>
              <div className="form-group" style={{ marginTop: 0 }}>
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
                value={username} onChange={e => { setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '')); setUsernameDirty(true); }}
                required minLength={2} maxLength={30}
                autoComplete="username" autoCapitalize="none" spellCheck={false}
                aria-describedby={usernameMsg ? 'username-status' : undefined}
                aria-invalid={usernameBlocked || undefined}
              />
              {usernameMsg && (
                <p id="username-status" role="status" style={{ fontSize: '0.72rem', marginTop: 4, color: usernameMsg.color }}>
                  {usernameMsg.text}
                </p>
              )}
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="email">Email</label>
              <input
                id="email" type="email" className="form-input"
                value={email} onChange={e => setEmail(e.target.value)}
                required maxLength={254} autoComplete="email" autoCapitalize="none" spellCheck={false}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="password">Password</label>
              <input
                id="password" type="password" className="form-input" placeholder="Exactly 8 Characters"
                value={password} onChange={e => setPassword(e.target.value)}
                required minLength={8} maxLength={8} autoComplete="new-password"
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

            <div className="form-group">
              <label className="form-label" htmlFor="referralCode">
                {lockedRef ? 'Referred By (Locked)' : 'Referral Code (Optional)'}
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  id="referralCode" type="text" className="form-input"
                  placeholder="Agent Or Researcher Username / Code"
                  value={referralInput}
                  onChange={lockedRef ? undefined : (e => setReferralInput(e.target.value.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 50)))}
                  readOnly={!!lockedRef}
                  maxLength={50} autoCapitalize="none" spellCheck={false}
                  style={lockedRef ? {
                    paddingRight: 36,
                    background: 'rgba(0,196,188,0.06)',
                    border: '1px solid rgba(0,196,188,0.35)',
                    color: 'var(--teal)',
                    cursor: 'default',
                  } : undefined}
                />
                {lockedRef && (
                  <span style={{
                    position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                    color: 'var(--teal)', display: 'inline-flex', pointerEvents: 'none',
                  }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                  </span>
                )}
              </div>
              <p style={{ fontSize: '0.72rem', marginTop: 4, color: lockedRef ? 'var(--teal)' : 'var(--grey-500)' }}>
                {lockedRef
                  ? `You were referred by @${lockedRef}. This cannot be changed.`
                  : 'Enter the username of the agent or researcher who referred you, or their referral code.'}
              </p>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="promoCode">Promo Code (Optional)</label>
              <input
                id="promoCode" type="text" className="form-input"
                placeholder="Sign-Up Promo Code"
                value={promoInput}
                onChange={e => setPromoInput(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 40))}
                maxLength={40} autoCapitalize="characters" spellCheck={false}
              />
              <p style={{ fontSize: '0.72rem', marginTop: 4, color: 'var(--grey-500)' }}>
                Have a promo code? Enter it to unlock your sign-up reward.
              </p>
            </div>

            <div role="group" aria-label="Required Acknowledgments" style={{ margin: 'var(--space-5) 0', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {ACKNOWLEDGMENTS.map(a => (
                <label key={a.key} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={acks[a.key]}
                    onChange={e => setAcks(prev => ({ ...prev, [a.key]: e.target.checked }))}
                    style={{ marginTop: 3, accentColor: 'var(--teal)', flexShrink: 0 }}
                  />
                  <span style={{ fontSize: '0.78rem', color: 'var(--grey-300)', lineHeight: 1.5 }}>
                    {a.key === 'c3' ? (
                      <>
                        I Have Read And Accept The <a href="/terms" target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{ color: 'var(--teal)', textDecoration: 'underline' }}>Terms Of Service</a>, <a href="/privacy" target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{ color: 'var(--teal)', textDecoration: 'underline' }}>Privacy Policy</a>, And <a href="/compliance" target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{ color: 'var(--teal)', textDecoration: 'underline' }}>Research-Only Compliance Requirements</a>.
                      </>
                    ) : (
                      a.text
                    )}
                  </span>
                </label>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', width: '100%', marginTop: '20px' }}>
              <button
                type="submit"
                className="btn btn-primary hover-lift"
                style={{ width: '100%', maxWidth: 300, display: 'flex', justifyContent: 'center', textAlign: 'center' }}
                disabled={loading || !allAcked || !firstName || !lastName || !username || !email || password.length !== 8 || usernameBlocked || usernameCheck.status === 'checking'}
              >
                {loading
                  ? 'Creating Account...'
                  : usernameBlocked
                    ? 'Pick A Different Username'
                    : usernameCheck.status === 'checking'
                      ? 'Checking Username...'
                      : 'Create Account'}
              </button>
            </div>
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

      {showGoogleModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 99999, padding: 'var(--space-4)'
        }}>
          {/* Thick brushed-nickel frame around the modal */}
          <div style={{
            width: '100%', maxWidth: 474, padding: 7, borderRadius: 18,
            background: 'repeating-linear-gradient(105deg, rgba(255,255,255,0.09) 0px, rgba(255,255,255,0.09) 1px, rgba(0,0,0,0.05) 2px, rgba(0,0,0,0) 3px), linear-gradient(145deg, #e8e6e3 0%, #b3b0ac 18%, #d6d3ce 34%, #8f8c88 52%, #cfccc7 70%, #a19e9a 86%, #e2e0dd 100%)',
            boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.55), inset 0 -1px 2px rgba(0,0,0,0.45), 0 14px 48px rgba(0,0,0,0.7)',
          }}>
          {/* Solid dark panel (NOT glass-panel: its !important translucent bg
              + backdrop blur would smear the nickel frame into the interior) */}
          <div style={{ width: '100%', padding: 'var(--space-6)', position: 'relative', borderRadius: 12, background: '#0c1118', border: '1px solid rgba(255,255,255,0.08)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)' }}>

            {/* ── STEP 1: Acknowledgment Checkboxes ── */}
            {!showAgentRefStep && (
              <>
                <h2 style={{ fontSize: '1.2rem', marginBottom: 'var(--space-3)', color: 'var(--white)' }}>
                  Required Acknowledgments
                </h2>
                <p style={{ fontSize: '0.85rem', color: 'var(--grey-400)', marginBottom: 'var(--space-5)' }}>
                  Before connecting your Google account to a Pep Nation Lab researcher profile, please confirm the following:
                </p>

                <div role="group" aria-label="Required Acknowledgments" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', marginBottom: 'var(--space-6)' }}>
                  {ACKNOWLEDGMENTS.map(a => (
                    <label key={a.key} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={acks[a.key]}
                        onChange={e => setAcks(prev => ({ ...prev, [a.key]: e.target.checked }))}
                        style={{ marginTop: 3, accentColor: 'var(--teal)', flexShrink: 0 }}
                      />
                      <span style={{ fontSize: '0.78rem', color: 'var(--grey-300)', lineHeight: 1.5 }}>
                        {a.key === 'c3' ? (
                          <>
                            I Have Read And Accept The <a href="/terms" target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{ color: 'var(--teal)', textDecoration: 'underline' }}>Terms Of Service</a>, <a href="/privacy" target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{ color: 'var(--teal)', textDecoration: 'underline' }}>Privacy Policy</a>, And <a href="/compliance" target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{ color: 'var(--teal)', textDecoration: 'underline' }}>Research-Only Compliance Requirements</a>.
                          </>
                        ) : (
                          a.text
                        )}
                      </span>
                    </label>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => setShowGoogleModal(false)}
                    style={{ flex: 1, justifyContent: 'center' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={!allAcked || googleLoading}
                    onClick={() => {
                      // After acks: if agent already known from QR or locked ?ref=, skip referral step
                      if (capturedAgentSlug) {
                        proceedWithGoogle(capturedAgentSlug);
                      } else if (lockedRef) {
                        // Referral is locked from the URL — go straight through, no editable step
                        proceedWithGoogle(lockedRef);
                      } else {
                        // Pre-fill from ?ref= if present
                        if (referralInput && !googleReferralInput) setGoogleReferralInput(referralInput);
                        setShowAgentRefStep(true);
                      }
                    }}
                    style={{ flex: 2, justifyContent: 'center' }}
                  >
                    {googleLoading ? 'Redirecting...' : 'Confirm & Continue'}
                  </button>
                </div>
              </>
            )}

            {/* ── STEP 2: Agent Referral Capture ── */}
            {showAgentRefStep && (
              <>
                <div style={{ textAlign: 'center', marginBottom: 'var(--space-4)' }}>
                  {/* Step indicator */}
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 'var(--space-4)' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--teal)', opacity: 0.4 }} />
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--teal)' }} />
                  </div>
                  <h2 style={{ fontSize: '1.2rem', marginBottom: 'var(--space-2)', color: 'var(--white)' }}>
                    Who Referred You?
                  </h2>
                  <p style={{ fontSize: '0.83rem', color: 'var(--grey-400)', lineHeight: 1.5 }}>
                    Enter your agent&apos;s username to get linked to their store.<br />
                    <span style={{ fontSize: '0.78rem', color: 'var(--grey-500)' }}>This is optional. You can skip it.</span>
                  </p>
                </div>

                <div style={{ marginBottom: 'var(--space-5)' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', color: 'var(--grey-400)', marginBottom: 6, fontWeight: 600 }}>
                    Agent Username
                  </label>
                  <input
                    id="googleAgentRef"
                    type="text"
                    className="form-input"
                    value={googleReferralInput}
                    onChange={lockedRef
                      ? undefined
                      : (e => setGoogleReferralInput(e.target.value.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 50)))}
                    readOnly={!!lockedRef}
                    maxLength={50}
                    autoCapitalize="none"
                    spellCheck={false}
                    autoFocus
                    style={lockedRef ? {
                      background: 'rgba(0,196,188,0.06)',
                      border: '1px solid rgba(0,196,188,0.35)',
                      color: 'var(--teal)',
                      cursor: 'default',
                      width: '100%',
                    } : { width: '100%' }}
                  />
                  <p style={{ fontSize: '0.72rem', marginTop: 6, color: lockedRef ? 'var(--teal)' : 'var(--grey-500)' }}>
                    {lockedRef
                      ? `You were referred by @${lockedRef}. This cannot be changed.`
                      : 'Not sure? Leave it blank and tap Skip. You can update this later from your account settings.'}
                  </p>
                </div>

                <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={googleLoading}
                    onClick={() => proceedWithGoogle(undefined)}
                    style={{ flex: 1, justifyContent: 'center' }}
                  >
                    Skip
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={googleLoading}
                    onClick={() => proceedWithGoogle(googleReferralInput.trim() || undefined)}
                    style={{ flex: 2, justifyContent: 'center' }}
                  >
                    {googleLoading ? 'Redirecting...' : 'Continue With Google →'}
                  </button>
                </div>

                {/* Back link */}
                <button
                  type="button"
                  onClick={() => setShowAgentRefStep(false)}
                  style={{ display: 'block', width: '100%', textAlign: 'center', marginTop: 'var(--space-3)', background: 'none', border: 'none', color: 'var(--grey-500)', fontSize: '0.78rem', cursor: 'pointer' }}
                >
                  ← Back
                </button>
              </>
            )}

          </div>
          </div>
        </div>
      )}
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
