'use client';

/**
 * OnboardingWizard
 *
 * Role-tailored guided setup for super agents, agents, and sub-agents. Backed
 * by /api/agent/onboarding (GET = computed steps + prefilled data, POST = the
 * per-step writes + final completion). Shows a live completion percentage,
 * congratulates the new partner, and auto-advances to the next step the moment
 * the current one is satisfied -- "easy to follow and click automated Next".
 *
 * The page that renders this (app/onboarding/page.tsx) already guarantees the
 * caller is an un-onboarded agent-type account, so this component focuses on
 * the flow itself. Title Case + no emojis per platform rules; icons are
 * lucide-react.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Lock, BellRing, UserRound, Warehouse, Store, Tag, Percent, Users,
  CheckCircle2, XCircle, ArrowRight, ArrowLeft, Loader2, ShieldCheck, Smartphone, RotateCw,
} from 'lucide-react';
import { isWebPushSupported, enablePush } from '@/lib/push-client';

type WizardRole = 'super_agent' | 'agent' | 'sub_agent';

interface StepDef { key: string; label: string; done: boolean }

interface OnboardingState {
  role: WizardRole;
  applicable: boolean;
  completed: boolean;
  completion_pct: number;
  steps: StepDef[];
  notifications_enabled: boolean;
  pricing_v2_active: boolean;
  profile: { first_name: string; last_name: string; email: string; phone: string; username: string; must_change_password: boolean };
  storefront: { slug: string | null; display_name: string | null; warehouse_address: Record<string, string> | null } | null;
  markup: { stored_pct: number | null; default_pct: number };
  downstream: { default_sub_commission_pct: number | null; default_agent_markup_pct: number | null; default_agent_pricing_mode: 'flat' | 'gamified' };
  parent: { name: string | null; slug: string | null; commission_pct: number | null } | null;
  progress: Record<string, unknown>;
}

const ROLE_LABEL: Record<WizardRole, string> = {
  super_agent: 'Super Agent',
  agent: 'Agent',
  sub_agent: 'Sub-Agent',
};

const FINISH_KEY = 'finish';

async function postOnboarding(payload: Record<string, unknown>) {
  const res = await fetch('/api/agent/onboarding', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || 'Save Failed');
  return json;
}

// ---- shared little UI atoms -------------------------------------------------

const labelStyle: React.CSSProperties = { display: 'block', marginBottom: 6, color: 'var(--grey-300)', fontSize: '0.82rem' };
const inputStyle: React.CSSProperties = {
  width: '100%', padding: '11px 13px', background: 'var(--bg-metal-dark, #0d1722)',
  border: '1px solid rgba(255,255,255,0.12)', color: 'var(--white)', borderRadius: 8, fontSize: '0.95rem',
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 'var(--space-3, 12px)' }}>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}

function StepIntro({ icon: Icon, title, blurb }: { icon: React.ComponentType<{ size?: number }>; title: string; blurb: string }) {
  return (
    <div style={{ marginBottom: 'var(--space-5, 20px)' }}>
      <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 46, height: 46, borderRadius: 12, background: 'rgba(0,196,188,0.12)', border: '1px solid rgba(0,196,188,0.35)', color: 'var(--teal)', marginBottom: 'var(--space-3, 12px)' }}>
        <Icon size={24} />
      </div>
      <h2 style={{ fontSize: '1.35rem', color: 'var(--white)', margin: '0 0 6px' }}>{title}</h2>
      <p style={{ fontSize: '0.9rem', color: 'var(--grey-300)', margin: 0, lineHeight: 1.5 }}>{blurb}</p>
    </div>
  );
}

// =============================================================================

export default function OnboardingWizard() {
  const router = useRouter();
  const [state, setState] = useState<OnboardingState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [idx, setIdx] = useState(0);
  const [showResume, setShowResume] = useState(false);

  const refresh = useCallback(async (): Promise<OnboardingState | null> => {
    const res = await fetch('/api/agent/onboarding', { cache: 'no-store' });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json || json.applicable === false) {
      setLoadError('Could Not Load Your Setup. Please Refresh.');
      return null;
    }
    setState(json as OnboardingState);
    return json as OnboardingState;
  }, []);

  useEffect(() => {
    (async () => {
      const s = await refresh();
      if (s) {
        const firstPending = s.steps.findIndex((st) => !st.done);
        const landing = firstPending === -1 ? s.steps.length : firstPending;
        setIdx(landing);
        // Returning mid-flow: some steps already complete and there is more to do.
        if (landing > 0 && landing < s.steps.length) setShowResume(true);
      }
    })();
  }, [refresh]);

  // The full ordered key list = the role's steps plus a celebratory finish.
  const orderedKeys = useMemo(() => {
    if (!state) return [] as string[];
    return [...state.steps.map((s) => s.key), FINISH_KEY];
  }, [state]);

  const currentKey = orderedKeys[idx] ?? FINISH_KEY;

  const goBack = useCallback(() => { setShowResume(false); setIdx((i) => Math.max(i - 1, 0)); }, []);

  // Called by a step after it persists; re-pulls state then lands on the first
  // still-incomplete step. Recomputing (instead of a blind +1) keeps the index
  // correct even when the step list shrinks -- e.g. the password step drops out
  // of the list once must_change_password is cleared.
  const completeStepAndAdvance = useCallback(async () => {
    setShowResume(false);
    const s = await refresh();
    if (!s) return;
    const next = s.steps.findIndex((st) => !st.done);
    setIdx(next === -1 ? s.steps.length : next);
  }, [refresh]);

  if (loadError) {
    return (
      <Shell pct={0}>
        <p style={{ color: 'var(--danger, #E53E3E)', textAlign: 'center' }}>{loadError}</p>
        <button className="btn btn-primary" style={{ width: '100%', marginTop: 12 }} onClick={() => location.reload()}>Reload</button>
      </Shell>
    );
  }

  if (!state) {
    return (
      <Shell pct={0}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40, color: 'var(--silver)' }}>
          <Loader2 size={28} className="spin" />
        </div>
      </Shell>
    );
  }

  const pct = currentKey === FINISH_KEY ? 100 : state.completion_pct;
  const stepNumber = Math.min(idx + 1, orderedKeys.length);

  return (
    <Shell pct={pct} role={state.role} stepNumber={stepNumber} totalSteps={orderedKeys.length}>
      {showResume && currentKey !== FINISH_KEY && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', marginBottom: 'var(--space-4, 16px)', borderRadius: 10, background: 'rgba(0,196,188,0.08)', border: '1px solid rgba(0,196,188,0.3)' }}>
          <CheckCircle2 size={18} style={{ color: 'var(--teal)', flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.88rem', color: 'var(--white)', fontWeight: 700 }}>Welcome Back</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--grey-300)' }}>You Are {pct}% Done. Let Us Pick Up Where You Left Off.</div>
          </div>
          <button type="button" onClick={() => setShowResume(false)} aria-label="Dismiss" style={{ background: 'transparent', border: 'none', color: 'var(--grey-400)', cursor: 'pointer', fontSize: '0.8rem' }}>Dismiss</button>
        </div>
      )}

      {currentKey === 'password' && <PasswordStep onDone={completeStepAndAdvance} />}
      {currentKey === 'notifications' && <NotificationsStep onDone={completeStepAndAdvance} />}
      {currentKey === 'profile' && <ProfileStep state={state} onDone={completeStepAndAdvance} />}
      {currentKey === 'warehouse' && <WarehouseStep state={state} onDone={completeStepAndAdvance} />}
      {currentKey === 'storefront' && <StorefrontStep state={state} onDone={completeStepAndAdvance} />}
      {currentKey === 'products' && <ProductsTutorialStep state={state} onDone={completeStepAndAdvance} />}
      {currentKey === 'downstream' && <DownstreamStep state={state} onDone={completeStepAndAdvance} />}
      {currentKey === 'commission_info' && <CommissionInfoStep state={state} onDone={completeStepAndAdvance} />}
      {currentKey === FINISH_KEY && <FinishStep state={state} onEnter={() => router.push(state.role === 'sub_agent' ? '/dashboard/sub-agent' : '/dashboard/agent')} />}

      {idx > 0 && currentKey !== FINISH_KEY && (
        <button type="button" className="btn btn-ghost" style={{ marginTop: 14, display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.84rem' }} onClick={goBack}>
          <ArrowLeft size={15} /> Back
        </button>
      )}
    </Shell>
  );
}

// ---- chrome -----------------------------------------------------------------

function Shell({ children, pct, role, stepNumber, totalSteps }: {
  children: React.ReactNode; pct: number; role?: WizardRole; stepNumber?: number; totalSteps?: number;
}) {
  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg, #050A0F)', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 'max(20px, env(safe-area-inset-top)) 16px 40px' }}>
      <div style={{ width: '100%', maxWidth: 620 }}>
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-4, 16px)', paddingTop: 12 }}>
          <div style={{ fontSize: '0.74rem', letterSpacing: '0.18em', textTransform: 'uppercase', color: 'var(--teal)', fontWeight: 700 }}>
            Pep Nation {role ? ROLE_LABEL[role] : ''} Setup
          </div>
        </div>

        {/* progress */}
        <div style={{ marginBottom: 'var(--space-5, 20px)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--grey-400)' }}>
              {typeof stepNumber === 'number' && typeof totalSteps === 'number' ? `Step ${stepNumber} Of ${totalSteps}` : 'Getting Started'}
            </span>
            <span style={{ fontSize: '0.82rem', color: 'var(--teal)', fontWeight: 800 }}>{pct}% Complete</span>
          </div>
          <div style={{ height: 8, borderRadius: 99, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg, var(--teal, #00C4BC), #57e3dc)', borderRadius: 99, transition: 'width 420ms cubic-bezier(.2,.8,.2,1)' }} />
          </div>
        </div>

        <div className="glass-panel" style={{ padding: 'var(--space-6, 24px)', borderRadius: 16 }}>
          {children}
        </div>
      </div>
      <style>{`@keyframes pnlspin{to{transform:rotate(360deg)}}.spin{animation:pnlspin 0.9s linear infinite}`}</style>
    </div>
  );
}

function PrimaryButton({ onClick, busy, children, disabled }: { onClick: () => void; busy?: boolean; children: React.ReactNode; disabled?: boolean }) {
  return (
    <button type="button" className="btn btn-primary" disabled={busy || disabled} onClick={onClick}
      style={{ width: '100%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 'var(--space-4, 16px)', fontSize: '0.95rem', opacity: busy || disabled ? 0.7 : 1 }}>
      {busy ? <Loader2 size={17} className="spin" /> : null}
      {children}
      {!busy ? <ArrowRight size={17} /> : null}
    </button>
  );
}

function ErrorLine({ msg }: { msg: string | null }) {
  if (!msg) return null;
  return <p style={{ color: 'var(--danger, #E53E3E)', fontSize: '0.82rem', marginTop: 10 }}>{msg}</p>;
}

// ---- steps ------------------------------------------------------------------

function PasswordStep({ onDone }: { onDone: () => void }) {
  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setErr(null);
    if (pw.length < 8) { setErr('Password Must Be At Least 8 Characters.'); return; }
    if (pw !== confirm) { setErr('Passwords Do Not Match.'); return; }
    setBusy(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ newPassword: pw }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Could Not Update Password.');
      onDone();
    } catch (e) { setErr(e instanceof Error ? e.message : 'Could Not Update Password.'); setBusy(false); }
  };

  return (
    <div>
      <StepIntro icon={Lock} title="Secure Your Password"
        blurb="Your Account Was Created With A Temporary Password. Choose Your Own Private Password To Continue." />
      <Field label="New Password">
        <input type="password" style={inputStyle} value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" placeholder="At Least 8 Characters" />
      </Field>
      <Field label="Confirm New Password">
        <input type="password" style={inputStyle} value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
      </Field>
      <ErrorLine msg={err} />
      <PrimaryButton onClick={submit} busy={busy}>Set Password And Continue</PrimaryButton>
    </div>
  );
}

/**
 * Verified notifications: the step is satisfied only when enablePush() succeeds
 * and persists a real subscription server-side. There is no "I have done this"
 * bypass. On surfaces that cannot subscribe (e.g. an iOS Safari tab before the
 * app is added to the home screen), we show install-first guidance and a
 * Re-Check button -- once the user enables push in the installed app, the
 * server sees the subscription and this step advances.
 */
/** A single numbered instruction row: teal circle + text. */
function NumberedStep({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
      <div style={{ flexShrink: 0, width: 22, height: 22, borderRadius: '50%', background: 'rgba(0,196,188,0.15)', border: '1px solid rgba(0,196,188,0.5)', color: 'var(--teal)', fontSize: '0.72rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>{n}</div>
      <div style={{ fontSize: '0.84rem', color: 'var(--grey-200, #D0DAE4)', lineHeight: 1.5 }}>{children}</div>
    </div>
  );
}

function NotificationsStep({ onDone }: { onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [supported, setSupported] = useState<boolean | null>(null);
  const [platform, setPlatform] = useState<'ios' | 'android' | 'desktop'>('desktop');

  useEffect(() => {
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
    const detectedPlatform: 'ios' | 'android' | 'desktop' =
      /iphone|ipad|ipod/i.test(ua) ? 'ios' : /android/i.test(ua) ? 'android' : 'desktop';
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time post-mount capability sync
    setSupported(isWebPushSupported());
    setPlatform(detectedPlatform);
  }, []);

  // Platform-specific, click-by-click instructions. iOS push only works from
  // the installed home-screen app, so its steps install first.
  const heading =
    platform === 'ios' ? 'On iPhone Or iPad' : platform === 'android' ? 'On Android' : 'On This Computer';
  const steps: string[] =
    platform === 'ios'
      ? [
          'Tap The Share Button In Safari (The Square With An Arrow Pointing Up).',
          'Scroll Down, Tap "Add To Home Screen", Then Tap "Add".',
          'Open Pep Nation From Its New Home Screen Icon.',
          'Come Back Here And Tap "Turn On Notifications" Below.',
          'When iOS Asks, Tap "Allow".',
        ]
      : platform === 'android'
        ? [
            'Open Your Browser Menu (The Three Dots In The Top Right).',
            'Tap "Install App" Or "Add To Home Screen".',
            'Open Pep Nation From Its New Home Screen Icon.',
            'Tap "Turn On Notifications" Below.',
            'When Your Browser Asks, Tap "Allow".',
          ]
        : [
            'Click The "Turn On Notifications" Button Below.',
            'A Small Box Will Pop Up At The Top Of Your Browser Window.',
            'Click "Allow" In That Box.',
            'Optional: Click The Install Icon In The Address Bar To Open Pep Nation As Its Own App.',
          ];

  const enableAndContinue = async () => {
    setBusy(true); setErr(null);
    try {
      const r = await enablePush();
      if (r.ok) {
        // Subscription is now saved server-side; advancing re-derives the step.
        await onDone();
        return;
      }
      setErr(r.error || 'Notifications Could Not Be Turned On. Please Follow The Steps Above And Try Again.');
    } catch {
      setErr('Notifications Could Not Be Turned On On This Device.');
    }
    setBusy(false);
  };

  const recheck = async () => {
    setBusy(true); setErr(null);
    await onDone();
    setBusy(false);
  };

  return (
    <div>
      <StepIntro icon={BellRing} title="Turn On Notifications"
        blurb="Notifications Let You Know The Moment You Get A New Order Or Payment. Follow The Steps For Your Device Below. This Step Finishes Only Once Notifications Are Actually On." />

      {/* Step-by-step instructions for the detected device */}
      <div style={{ padding: 'var(--space-4, 16px)', borderRadius: 12, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', marginBottom: 'var(--space-4, 16px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 'var(--space-3, 12px)' }}>
          <Smartphone size={16} style={{ color: 'var(--teal)' }} />
          <span style={{ fontSize: '0.78rem', fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--teal)' }}>{heading}</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3, 12px)' }}>
          {steps.map((s, i) => (
            <NumberedStep key={i} n={i + 1}>{s}</NumberedStep>
          ))}
        </div>
      </div>

      {/* The single most-missed step, called out. */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: 'var(--space-3, 12px)', borderRadius: 10, background: 'rgba(0,196,188,0.08)', border: '1px solid rgba(0,196,188,0.3)', marginBottom: 'var(--space-4, 16px)' }}>
        <CheckCircle2 size={18} style={{ color: 'var(--teal)', flexShrink: 0, marginTop: 1 }} />
        <p style={{ fontSize: '0.82rem', color: 'var(--grey-200, #D0DAE4)', margin: 0, lineHeight: 1.5 }}>
          The Most Important Part: When Your Device Asks For Permission, You Must Choose <strong style={{ color: 'var(--white)' }}>Allow</strong>. If You Pick Block Or Don&apos;t Allow, Notifications Stay Off.
        </p>
      </div>

      {supported === false ? (
        <>
          <p style={{ fontSize: '0.82rem', color: 'var(--grey-400)', lineHeight: 1.5 }}>
            This Browser Tab Cannot Receive Notifications Yet. Add Pep Nation To Your Home Screen Using The Steps Above, Open It From The Icon, Then Tap Re-Check.
          </p>
          <button type="button" className="btn btn-secondary" onClick={recheck} disabled={busy}
            style={{ width: '100%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 'var(--space-3, 12px)' }}>
            {busy ? <Loader2 size={16} className="spin" /> : <RotateCw size={16} />} I Have Done This, Re-Check
          </button>
        </>
      ) : (
        <>
          <ErrorLine msg={err} />
          <PrimaryButton onClick={enableAndContinue} busy={busy}>Turn On Notifications</PrimaryButton>
          <button type="button" onClick={recheck} disabled={busy}
            style={{ width: '100%', marginTop: 10, background: 'transparent', border: 'none', color: 'var(--grey-400)', cursor: 'pointer', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            <RotateCw size={13} /> Already Turned Them On? Re-Check
          </button>
        </>
      )}
    </div>
  );
}

function ProfileStep({ state, onDone }: { state: OnboardingState; onDone: () => void }) {
  const [first, setFirst] = useState(state.profile.first_name);
  const [last, setLast] = useState(state.profile.last_name);
  const [email, setEmail] = useState(state.profile.email);
  const [phone, setPhone] = useState(state.profile.phone);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setErr(null);
    if (!first.trim() || !last.trim()) { setErr('First And Last Name Are Required.'); return; }
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) { setErr('A Valid Email Is Required.'); return; }
    if (phone.trim().length < 7) { setErr('A Valid Phone Number Is Required.'); return; }
    setBusy(true);
    try {
      await postOnboarding({ action: 'profile', data: { first_name: first.trim(), last_name: last.trim(), email: email.trim(), phone: phone.trim() } });
      onDone();
    } catch (e) { setErr(e instanceof Error ? e.message : 'Save Failed'); setBusy(false); }
  };

  return (
    <div>
      <StepIntro icon={UserRound} title="Confirm Your Contact Details"
        blurb="Make Sure Your Name, Phone, And Email Are Correct. We Use These For Order Updates And Account Recovery." />
      <div style={{ display: 'flex', gap: 'var(--space-3, 12px)', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 180px' }}><Field label="First Name"><input style={inputStyle} value={first} onChange={(e) => setFirst(e.target.value)} /></Field></div>
        <div style={{ flex: '1 1 180px' }}><Field label="Last Name"><input style={inputStyle} value={last} onChange={(e) => setLast(e.target.value)} /></Field></div>
      </div>
      <Field label="Email Address"><input type="email" style={inputStyle} value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
      <Field label="Phone Number"><input type="tel" style={inputStyle} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 555-5555" /></Field>
      <ErrorLine msg={err} />
      <PrimaryButton onClick={submit} busy={busy}>Save And Continue</PrimaryButton>
    </div>
  );
}

/**
 * Warehouse step with Shippo address validation. On save we validate the
 * address; if Shippo returns a standardized suggestion that differs, we show a
 * compare panel so the user can accept the corrected version before it is
 * saved. If Shippo is unconfigured/unavailable the endpoint soft-oks and we
 * save what was entered.
 */
type Addr = { street1: string; street2: string; city: string; state: string; zip: string };

function WarehouseStep({ state, onDone }: { state: OnboardingState; onDone: () => void }) {
  const w = state.storefront?.warehouse_address ?? {};
  const [street1, setStreet1] = useState(w.street1 ?? '');
  const [street2, setStreet2] = useState(w.street2 ?? '');
  const [city, setCity] = useState(w.city ?? '');
  const [statev, setStatev] = useState(w.state ?? '');
  const [zip, setZip] = useState(w.zip ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<Addr | null>(null);

  const current = (): Addr => ({ street1: street1.trim(), street2: street2.trim(), city: city.trim(), state: statev.trim(), zip: zip.trim() });

  const persist = async (addr: Addr) => {
    try {
      await postOnboarding({ action: 'warehouse', data: { ...addr, country: 'US' } });
      onDone();
    } catch (e) { setErr(e instanceof Error ? e.message : 'Save Failed'); setBusy(false); }
  };

  const submit = async () => {
    setErr(null); setSuggestion(null);
    const a = current();
    if (!a.street1 || !a.city || !a.state || !a.zip) { setErr('Street, City, State, And Zip Are Required.'); return; }
    setBusy(true);
    // Validate via Shippo (best-effort). A standardized suggestion prompts a confirm.
    try {
      const res = await fetch('/api/shipping/validate-address', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: { ...a, country: 'US' } }),
      });
      const v = await res.json().catch(() => ({}));
      const s = v?.suggestion as Partial<Addr> | undefined;
      if (s && (s.street1 || s.city || s.state || s.zip)) {
        const norm: Addr = {
          street1: String(s.street1 ?? a.street1), street2: String(s.street2 ?? a.street2),
          city: String(s.city ?? a.city), state: String(s.state ?? a.state), zip: String(s.zip ?? a.zip),
        };
        const differs = norm.street1 !== a.street1 || norm.city !== a.city || norm.state !== a.state || norm.zip !== a.zip;
        if (differs) { setSuggestion(norm); setBusy(false); return; }
      }
    } catch {
      /* validation unavailable -- proceed to save as entered */
    }
    await persist(a);
  };

  const acceptSuggested = async () => {
    if (!suggestion) return;
    setStreet1(suggestion.street1); setStreet2(suggestion.street2); setCity(suggestion.city);
    setStatev(suggestion.state); setZip(suggestion.zip);
    setBusy(true);
    await persist(suggestion);
  };

  return (
    <div>
      <StepIntro icon={Warehouse} title="Add Your Warehouse Address"
        blurb="This Is Where Your Inventory Shipments Are Delivered. Your Restocks From Pep Nation Ship To This Address, So Make Sure It Is Accurate." />
      <Field label="Street Address"><input style={inputStyle} value={street1} onChange={(e) => setStreet1(e.target.value)} placeholder="100 Lab Way" /></Field>
      <Field label="Suite / Unit (Optional)"><input style={inputStyle} value={street2} onChange={(e) => setStreet2(e.target.value)} /></Field>
      <div style={{ display: 'flex', gap: 'var(--space-3, 12px)', flexWrap: 'wrap' }}>
        <div style={{ flex: '2 1 160px' }}><Field label="City"><input style={inputStyle} value={city} onChange={(e) => setCity(e.target.value)} /></Field></div>
        <div style={{ flex: '1 1 80px' }}><Field label="State"><input style={inputStyle} value={statev} onChange={(e) => setStatev(e.target.value)} placeholder="TX" /></Field></div>
        <div style={{ flex: '1 1 100px' }}><Field label="Zip"><input style={inputStyle} value={zip} onChange={(e) => setZip(e.target.value)} /></Field></div>
      </div>

      {suggestion && (
        <div style={{ padding: 'var(--space-3, 12px)', borderRadius: 10, background: 'rgba(0,196,188,0.06)', border: '1px solid rgba(0,196,188,0.3)', marginTop: 'var(--space-2, 8px)' }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--white)', fontWeight: 700, marginBottom: 4 }}>We Found A Standardized Address</div>
          <div style={{ fontSize: '0.82rem', color: 'var(--grey-300)', lineHeight: 1.5 }}>
            {suggestion.street1}{suggestion.street2 ? `, ${suggestion.street2}` : ''}<br />
            {suggestion.city}, {suggestion.state} {suggestion.zip}
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-2, 8px)', marginTop: 'var(--space-3, 12px)', flexWrap: 'wrap' }}>
            <button type="button" className="btn btn-primary" onClick={acceptSuggested} disabled={busy} style={{ flex: '1 1 160px' }}>Use Standardized Address</button>
            <button type="button" className="btn btn-secondary" onClick={() => persist(current())} disabled={busy} style={{ flex: '1 1 140px' }}>Use What I Entered</button>
          </div>
        </div>
      )}

      <ErrorLine msg={err} />
      {!suggestion && <PrimaryButton onClick={submit} busy={busy}>Save And Continue</PrimaryButton>}
    </div>
  );
}

/**
 * Storefront step with live slug availability (debounced) + tap-to-use
 * suggestions. The POST remains authoritative; the live check is UX only.
 */
function StorefrontStep({ state, onDone }: { state: OnboardingState; onDone: () => void }) {
  const initialSlug = state.storefront?.slug && !/^agent(?:-|$)/i.test(state.storefront.slug) ? state.storefront.slug : '';
  const [slug, setSlug] = useState(initialSlug);
  const [displayName, setDisplayName] = useState(state.storefront?.display_name ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [avail, setAvail] = useState<{ available: boolean; reason?: string; suggestions: string[] } | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const formatOk = /^[a-z0-9-]{3,30}$/.test(slug.trim().toLowerCase());

  useEffect(() => {
    const clean = slug.trim().toLowerCase();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!/^[a-z0-9-]{3,30}$/.test(clean)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clearing stale availability for an invalid candidate
      setAvail(null);
      setChecking(false);
      return;
    }
    setChecking(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/agent/storefront-slug/check?slug=${encodeURIComponent(clean)}`, { cache: 'no-store' });
        const json = await res.json().catch(() => null);
        if (json) setAvail({ available: !!json.available, reason: json.reason, suggestions: Array.isArray(json.suggestions) ? json.suggestions : [] });
      } catch {
        setAvail(null);
      } finally {
        setChecking(false);
      }
    }, 450);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [slug]);

  const submit = async () => {
    setErr(null);
    const clean = slug.trim().toLowerCase();
    if (!formatOk) { setErr('Web Address Must Be 3-30 Characters: Lowercase Letters, Numbers, And Hyphens Only.'); return; }
    setBusy(true);
    try {
      const slugRes = await fetch('/api/agent/storefront-slug', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slug: clean }) });
      const slugJson = await slugRes.json().catch(() => ({}));
      if (!slugRes.ok) throw new Error(slugJson.error || 'That Web Address Is Not Available.');

      if (displayName.trim().length >= 2) {
        // Best-effort display name; a 6-month cooldown collision should not block onboarding.
        await fetch('/api/agent/storefront-name', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_name: displayName.trim() }) }).catch(() => null);
      }
      await postOnboarding({ action: 'ack', key: 'storefront' });
      onDone();
    } catch (e) { setErr(e instanceof Error ? e.message : 'Save Failed'); setBusy(false); }
  };

  const unavailable = formatOk && avail !== null && avail.available === false;

  return (
    <div>
      <StepIntro icon={Store} title="Set Up Your Storefront"
        blurb="Choose The Web Address Your Researchers Will Use To Reach Your Store. Pick Something Short And Memorable -- This Is Your Public Storefront Link." />
      <Field label="Storefront Web Address">
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: '0.85rem', color: 'var(--grey-400)', whiteSpace: 'nowrap' }}>pepnationlab.com/</span>
          <input style={inputStyle} value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase())} placeholder="your-store" />
        </div>
      </Field>

      {formatOk && (
        <div style={{ minHeight: 22, marginTop: -4, marginBottom: 'var(--space-2, 8px)' }}>
          {checking ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: 'var(--grey-400)' }}>
              <Loader2 size={13} className="spin" /> Checking Availability...
            </span>
          ) : avail?.available ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: '#68D391' }}>
              <CheckCircle2 size={14} /> Available
            </span>
          ) : unavailable ? (
            <div>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', color: 'var(--danger, #E53E3E)' }}>
                <XCircle size={14} /> {avail?.reason || 'Not Available'}
              </span>
              {avail && avail.suggestions.length > 0 && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                  {avail.suggestions.map((s) => (
                    <button key={s} type="button" onClick={() => setSlug(s)}
                      style={{ fontSize: '0.78rem', padding: '4px 10px', borderRadius: 999, border: '1px solid rgba(0,196,188,0.4)', background: 'rgba(0,196,188,0.08)', color: 'var(--teal)', cursor: 'pointer' }}>
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </div>
      )}

      <Field label="Display Name (Shown On Your Store)">
        <input style={inputStyle} value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Your Store Name" />
      </Field>
      <ErrorLine msg={err} />
      <PrimaryButton onClick={submit} busy={busy} disabled={!formatOk || checking || unavailable}>Save And Continue</PrimaryButton>
    </div>
  );
}

function ProductsTutorialStep({ state, onDone }: { state: OnboardingState; onDone: () => void }) {
  const isSuper = state.role === 'super_agent';
  const [markup, setMarkup] = useState(String(state.markup.default_pct ?? 0));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const pctNum = Number(markup) || 0;

  const submit = async () => {
    setErr(null);
    const pct = Number(markup);
    if (!Number.isFinite(pct) || pct < 0 || pct > 500) { setErr('Enter A Markup Between 0 And 500 Percent.'); return; }
    setBusy(true);
    try {
      await postOnboarding({ action: 'markup', markup_pct: pct });
      await postOnboarding({ action: 'ack', key: 'product_tutorial' });
      onDone();
    } catch (e) { setErr(e instanceof Error ? e.message : 'Save Failed'); setBusy(false); }
  };

  return (
    <div>
      <StepIntro icon={Tag} title="How Product Pricing And Markup Work"
        blurb="Every Product Has A Wholesale Cost. Your Markup Is The Percentage Added On Top Of That Cost To Set Your Price. A Higher Markup Means More Margin Per Sale." />

      {state.pricing_v2_active && (
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.74rem', color: 'var(--teal)', fontWeight: 700, padding: '4px 10px', borderRadius: 999, background: 'rgba(0,196,188,0.1)', border: '1px solid rgba(0,196,188,0.3)', marginBottom: 'var(--space-3, 12px)' }}>
          <CheckCircle2 size={13} /> Live Pricing Active -- Your Markup Applies Immediately
        </div>
      )}

      <div style={{ padding: 'var(--space-4, 16px)', borderRadius: 10, background: 'rgba(0,196,188,0.06)', border: '1px solid rgba(0,196,188,0.22)', marginBottom: 'var(--space-4, 16px)' }}>
        <div style={{ fontSize: '0.82rem', color: 'var(--grey-200, #D0DAE4)', lineHeight: 1.6 }}>
          <strong style={{ color: 'var(--white)' }}>Example:</strong> A Product With A $20 Wholesale Cost And A {markup || '0'}% Markup Is Priced At{' '}
          <strong style={{ color: 'var(--teal)' }}>${(20 * (1 + pctNum / 100)).toFixed(2)}</strong>.
        </div>
      </div>

      <Field label={isSuper ? 'Your Default Markup % (Recommended: 50%)' : 'Your Markup %'}>
        <input type="number" style={inputStyle} value={markup} onChange={(e) => setMarkup(e.target.value)} min="0" max="500" step="1" />
      </Field>
      <p style={{ fontSize: '0.78rem', color: 'var(--grey-400)', lineHeight: 1.5 }}>
        {isSuper
          ? 'We Have Set Your Default Markup To 50% To Get You Started. You Can Change This Anytime, And You Can Override The Price On Individual Products From The Products Page.'
          : 'You Can Change This Anytime, And You Can Override The Price On Individual Products From The Products Page.'}
      </p>
      <ErrorLine msg={err} />
      <PrimaryButton onClick={submit} busy={busy}>Save Markup And Continue</PrimaryButton>
    </div>
  );
}

/**
 * Downstream step now captures a real default that is applied to FUTURE
 * downstream accounts: a super agent sets a default markup METHOD for new
 * agents (flat percent or the platform gamification scale), a regular agent
 * sets a default commission for new sub-agents.
 */
function DownstreamStep({ state, onDone }: { state: OnboardingState; onDone: () => void }) {
  const isSuper = state.role === 'super_agent';
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const initial = isSuper
    ? (state.downstream.default_agent_markup_pct != null ? String(state.downstream.default_agent_markup_pct) : '30')
    : (state.downstream.default_sub_commission_pct != null ? String(state.downstream.default_sub_commission_pct) : '10');
  const [pct, setPct] = useState(initial);
  const [mode, setMode] = useState<'flat' | 'gamified'>(state.downstream.default_agent_pricing_mode ?? 'flat');

  const submit = async () => {
    setErr(null);
    const n = Number(pct);
    if (isSuper) {
      if (mode === 'flat' && (!Number.isFinite(n) || n < 0 || n > 500)) { setErr('Enter A Markup Between 0 And 500 Percent.'); return; }
    } else {
      if (!Number.isFinite(n) || n < 0 || n > 40) { setErr('Enter A Commission Between 0 And 40 Percent.'); return; }
    }
    setBusy(true);
    try {
      await postOnboarding(
        isSuper
          ? (mode === 'flat' ? { action: 'downstream_markup', mode: 'flat', pct: n } : { action: 'downstream_markup', mode: 'gamified' })
          : { action: 'downstream_commission', pct: n },
      );
      onDone();
    } catch (e) { setErr(e instanceof Error ? e.message : 'Save Failed'); setBusy(false); }
  };

  if (isSuper) {
    const tabStyle = (active: boolean): React.CSSProperties => ({
      flex: 1, padding: '10px 12px', borderRadius: 10, cursor: 'pointer', textAlign: 'center', fontSize: '0.84rem', fontWeight: 700,
      border: active ? '1px solid rgba(0,196,188,0.6)' : '1px solid rgba(255,255,255,0.12)',
      background: active ? 'rgba(0,196,188,0.12)' : 'transparent',
      color: active ? 'var(--teal)' : 'var(--grey-300)',
    });
    return (
      <div>
        <StepIntro icon={Percent} title="Set Your Agent Markup"
          blurb="Decide How Your Agents Are Priced On Top Of Wholesale Cost. Choose A Flat Markup Or The Gamification Scale. This Is Just The Default For New Agents -- You Can Change The Markup For Any Agent At Any Time From Your Agents Page." />

        <div style={{ display: 'flex', gap: 'var(--space-2, 8px)', marginBottom: 'var(--space-4, 16px)' }}>
          <button type="button" style={tabStyle(mode === 'flat')} onClick={() => setMode('flat')}>Flat Markup</button>
          <button type="button" style={tabStyle(mode === 'gamified')} onClick={() => setMode('gamified')}>Gamification Scale</button>
        </div>

        {mode === 'flat' ? (
          <>
            <div style={{ padding: 'var(--space-4, 16px)', borderRadius: 10, background: 'rgba(0,196,188,0.06)', border: '1px solid rgba(0,196,188,0.22)', marginBottom: 'var(--space-4, 16px)' }}>
              <div style={{ fontSize: '0.82rem', color: 'var(--grey-200, #D0DAE4)', lineHeight: 1.6 }}>
                <strong style={{ color: 'var(--white)' }}>Flat Markup:</strong> One Percentage Across The Board. A Product That Costs $10 Wholesale, With A {pct || '0'}% Markup, Is Priced At{' '}
                <strong style={{ color: 'var(--teal)' }}>${(10 * (1 + (Number(pct) || 0) / 100)).toFixed(2)}</strong> For Your Agents.
              </div>
            </div>
            <Field label="Default Agent Markup %">
              <input type="number" style={inputStyle} value={pct} onChange={(e) => setPct(e.target.value)} min="0" max="500" step="1" />
            </Field>
          </>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 'var(--space-4, 16px)' }}>
            <InfoRow icon={Tag} title="Volume-Based Pricing" body="Your Agents Ride The Platform Volume Ladder: Their Cost Markup Automatically Improves As Their Monthly Volume Grows, So Strong Sellers Earn Better Pricing." />
            <InfoRow icon={Users} title="No Flat Rate To Set" body="There Is No Fixed Percentage With The Gamification Scale -- The Ladder Sets Each Agent's Markup By Their Volume." />
          </div>
        )}

        <p style={{ fontSize: '0.78rem', color: 'var(--grey-400)', lineHeight: 1.5 }}>
          This Is Only The Default For New Agents. You Can Change Any Agent To A Different Markup Or Method At Any Time From Your Agents Page.
        </p>
        <ErrorLine msg={err} />
        <PrimaryButton onClick={submit} busy={busy}>Save Default And Continue</PrimaryButton>
      </div>
    );
  }

  // Regular agent setting a default sub-agent commission.
  return (
    <div>
      <StepIntro icon={Percent} title="Set Your Sub-Agent Commissions"
        blurb="Sub-Agents Sell On Your Storefront And Earn A Commission On Every Sale They Bring In. Set A Default Rate Now -- It Is Applied Automatically To Every New Sub-Agent, And You Can Still Customize Any Individual Sub-Agent Later." />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 'var(--space-4, 16px)' }}>
        <InfoRow icon={Percent} title="A Share Of Sales, Not A Markup" body="A Sub-Agent's Commission Is A Percentage Of The Sales They Generate -- It Is Paid Out Of Your Margin, It Does Not Raise The Researcher's Price." />
        <InfoRow icon={Users} title="Up To 40%" body="You Can Set Any Default Between 0 And 40 Percent, And Override It Per Sub-Agent From The Sub-Agents Section." />
      </div>
      <Field label="Default Sub-Agent Commission %">
        <input type="number" style={inputStyle} value={pct} onChange={(e) => setPct(e.target.value)} min="0" max="40" step="1" />
      </Field>
      <ErrorLine msg={err} />
      <PrimaryButton onClick={submit} busy={busy}>Save Default And Continue</PrimaryButton>
    </div>
  );
}

function CommissionInfoStep({ state, onDone }: { state: OnboardingState; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const pct = state.parent?.commission_pct;
  const parentName = state.parent?.name || 'Your Agent';

  const ack = async () => {
    setBusy(true); setErr(null);
    try { await postOnboarding({ action: 'ack', key: 'downstream_tutorial' }); onDone(); }
    catch (e) { setErr(e instanceof Error ? e.message : 'Save Failed'); setBusy(false); }
  };

  return (
    <div>
      <StepIntro icon={Percent} title="Understand How You Earn"
        blurb={`You Sell On ${parentName}'s Storefront And Earn A Commission On Every Sale You Bring In. There Is No Inventory Or Storefront For You To Manage.`} />
      <div style={{ padding: 'var(--space-4, 16px)', borderRadius: 10, background: 'rgba(0,196,188,0.06)', border: '1px solid rgba(0,196,188,0.22)', marginBottom: 'var(--space-4, 16px)' }}>
        <div style={{ fontSize: '0.9rem', color: 'var(--white)', marginBottom: 4 }}>Your Commission Rate</div>
        <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--teal)' }}>{pct != null ? `${pct}% Of Sales` : 'Set By Your Agent'}</div>
        <p style={{ fontSize: '0.8rem', color: 'var(--grey-300)', margin: '8px 0 0', lineHeight: 1.5 }}>
          This Is A Percentage Of The Sales You Generate -- Not A Markup. Track Your Pending And Settled Commission Anytime From Your Dashboard.
        </p>
      </div>
      <ErrorLine msg={err} />
      <PrimaryButton onClick={ack} busy={busy}>Got It, Continue</PrimaryButton>
    </div>
  );
}

function InfoRow({ icon: Icon, title, body }: { icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>; title: string; body: string }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: 'var(--space-3, 12px)', borderRadius: 10, background: 'rgba(255,255,255,0.04)' }}>
      <Icon size={18} style={{ color: 'var(--teal)', flexShrink: 0, marginTop: 2 }} />
      <div>
        <div style={{ fontSize: '0.86rem', color: 'var(--white)', fontWeight: 700, marginBottom: 2 }}>{title}</div>
        <div style={{ fontSize: '0.8rem', color: 'var(--grey-300)', lineHeight: 1.45 }}>{body}</div>
      </div>
    </div>
  );
}

function FinishStep({ state, onEnter }: { state: OnboardingState; onEnter: () => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const finish = async () => {
    setBusy(true); setErr(null);
    try {
      await postOnboarding({ action: 'complete' });
      onEnter();
    } catch (e) {
      const m = e instanceof Error ? e.message : 'Could Not Finish Setup';
      setErr(m === 'incomplete' ? 'Some Steps Are Still Incomplete. Please Go Back And Finish Them.' : m);
      setBusy(false);
    }
  };

  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 64, height: 64, borderRadius: '50%', background: 'rgba(0,196,188,0.14)', border: '1px solid rgba(0,196,188,0.4)', color: 'var(--teal)', marginBottom: 'var(--space-4, 16px)' }}>
        <ShieldCheck size={32} />
      </div>
      <h2 style={{ fontSize: '1.5rem', color: 'var(--white)', margin: '0 0 8px' }}>
        Congratulations, You Are Now A Pep Nation {ROLE_LABEL[state.role]}
      </h2>
      <p style={{ fontSize: '0.92rem', color: 'var(--grey-300)', lineHeight: 1.55, margin: '0 auto', maxWidth: 440 }}>
        Your Account Is Fully Set Up And Ready To Go. You Can Update Any Of These Settings Anytime From Your Dashboard.
      </p>
      <ErrorLine msg={err} />
      <PrimaryButton onClick={finish} busy={busy}>Enter My Dashboard</PrimaryButton>
    </div>
  );
}
