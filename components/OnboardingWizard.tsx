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

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Lock, BellRing, UserRound, Warehouse, Store, Tag, Percent, Users,
  CheckCircle2, ArrowRight, ArrowLeft, Loader2, ShieldCheck, Smartphone,
} from 'lucide-react';
import { isWebPushSupported, notificationPermission, enablePush } from '@/lib/push-client';

type WizardRole = 'super_agent' | 'agent' | 'sub_agent';

interface StepDef { key: string; label: string; done: boolean }

interface OnboardingState {
  role: WizardRole;
  applicable: boolean;
  completed: boolean;
  completion_pct: number;
  steps: StepDef[];
  profile: { first_name: string; last_name: string; email: string; phone: string; username: string; must_change_password: boolean };
  storefront: { slug: string | null; display_name: string | null; warehouse_address: Record<string, string> | null } | null;
  markup: { stored_pct: number | null; default_pct: number };
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
        setIdx(firstPending === -1 ? s.steps.length : firstPending);
      }
    })();
  }, [refresh]);

  // The full ordered key list = the role's steps plus a celebratory finish.
  const orderedKeys = useMemo(() => {
    if (!state) return [] as string[];
    return [...state.steps.map((s) => s.key), FINISH_KEY];
  }, [state]);

  const currentKey = orderedKeys[idx] ?? FINISH_KEY;

  const goBack = useCallback(() => setIdx((i) => Math.max(i - 1, 0)), []);

  // Called by a step after it persists; re-pulls state then lands on the first
  // still-incomplete step. Recomputing (instead of a blind +1) keeps the index
  // correct even when the step list shrinks -- e.g. the password step drops out
  // of the list once must_change_password is cleared.
  const completeStepAndAdvance = useCallback(async () => {
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

function NotificationsStep({ onDone }: { onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [supported, setSupported] = useState<boolean | null>(null);
  const [platform, setPlatform] = useState<'ios' | 'android' | 'desktop'>('desktop');

  useEffect(() => {
    // Browser-only detection: web-push support, current permission, and OS.
    // These APIs are undefined during SSR, so they must run after mount rather
    // than in a render-time initializer.
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
    const detectedPlatform: 'ios' | 'android' | 'desktop' =
      /iphone|ipad|ipod/i.test(ua) ? 'ios' : /android/i.test(ua) ? 'android' : 'desktop';
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time post-mount sync of device capabilities
    setSupported(isWebPushSupported());
    setEnabled(notificationPermission() === 'granted');
    setPlatform(detectedPlatform);
  }, []);

  const installCopy =
    platform === 'ios'
      ? 'On iPhone Or iPad: Tap The Share Button, Then "Add To Home Screen". Open Pep Nation From The Icon To Run It Full-Screen Like A Real App.'
      : platform === 'android'
        ? 'On Android: Open The Browser Menu, Then Tap "Install App" Or "Add To Home Screen". It Will Launch Full-Screen With No Address Bar.'
        : 'On Desktop: Click The Install Icon In Your Browser Address Bar To Add Pep Nation As An App Window.';

  const enable = async () => {
    setBusy(true); setErr(null);
    try {
      const r = await enablePush();
      if (r.ok) setEnabled(true);
      else setErr(r.error || 'Notifications Could Not Be Enabled On This Device. You Can Enable Them Later In Settings.');
    } catch { setErr('Notifications Could Not Be Enabled On This Device.'); }
    finally { setBusy(false); }
  };

  const continueOn = async () => {
    setBusy(true); setErr(null);
    try { await postOnboarding({ action: 'ack', key: 'notifications' }); onDone(); }
    catch (e) { setErr(e instanceof Error ? e.message : 'Save Failed'); setBusy(false); }
  };

  return (
    <div>
      <StepIntro icon={BellRing} title="Install The App And Turn On Notifications"
        blurb="Add Pep Nation To Your Home Screen So It Runs Full-Screen Like An App, And Turn On Notifications So You Never Miss An Order Or Payment." />

      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: 'var(--space-3, 12px)', borderRadius: 10, background: 'rgba(255,255,255,0.04)', marginBottom: 'var(--space-3, 12px)' }}>
        <Smartphone size={18} style={{ color: 'var(--teal)', flexShrink: 0, marginTop: 2 }} />
        <p style={{ fontSize: '0.83rem', color: 'var(--grey-300)', margin: 0, lineHeight: 1.5 }}>{installCopy}</p>
      </div>

      {enabled ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#68D391', fontSize: '0.9rem', padding: '10px 0' }}>
          <CheckCircle2 size={18} /> Notifications Are On For This Device.
        </div>
      ) : supported === false ? (
        <p style={{ fontSize: '0.82rem', color: 'var(--grey-400)', lineHeight: 1.5 }}>
          To Receive Push Notifications On iPhone, You Must First Add Pep Nation To Your Home Screen Using The Steps Above, Then Open It From The Icon And Return Here.
        </p>
      ) : (
        <button type="button" className="btn btn-secondary" onClick={enable} disabled={busy}
          style={{ width: '100%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          {busy ? <Loader2 size={16} className="spin" /> : <BellRing size={16} />} Turn On Notifications
        </button>
      )}

      <ErrorLine msg={err} />
      <PrimaryButton onClick={continueOn} busy={busy}>{enabled ? 'Continue' : 'I Have Done This, Continue'}</PrimaryButton>
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

function WarehouseStep({ state, onDone }: { state: OnboardingState; onDone: () => void }) {
  const w = state.storefront?.warehouse_address ?? {};
  const [street1, setStreet1] = useState(w.street1 ?? '');
  const [street2, setStreet2] = useState(w.street2 ?? '');
  const [city, setCity] = useState(w.city ?? '');
  const [statev, setStatev] = useState(w.state ?? '');
  const [zip, setZip] = useState(w.zip ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setErr(null);
    if (!street1.trim() || !city.trim() || !statev.trim() || !zip.trim()) { setErr('Street, City, State, And Zip Are Required.'); return; }
    setBusy(true);
    try {
      await postOnboarding({ action: 'warehouse', data: { street1: street1.trim(), street2: street2.trim(), city: city.trim(), state: statev.trim(), zip: zip.trim(), country: 'US' } });
      onDone();
    } catch (e) { setErr(e instanceof Error ? e.message : 'Save Failed'); setBusy(false); }
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
      <ErrorLine msg={err} />
      <PrimaryButton onClick={submit} busy={busy}>Save And Continue</PrimaryButton>
    </div>
  );
}

function StorefrontStep({ state, onDone }: { state: OnboardingState; onDone: () => void }) {
  const initialSlug = state.storefront?.slug && !/^agent(?:-|$)/i.test(state.storefront.slug) ? state.storefront.slug : '';
  const [slug, setSlug] = useState(initialSlug);
  const [displayName, setDisplayName] = useState(state.storefront?.display_name ?? '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setErr(null);
    const clean = slug.trim().toLowerCase();
    if (!/^[a-z0-9-]{3,30}$/.test(clean)) { setErr('Web Address Must Be 3-30 Characters: Lowercase Letters, Numbers, And Hyphens Only.'); return; }
    setBusy(true);
    try {
      const slugRes = await fetch('/api/agent/storefront-slug', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ slug: clean }) });
      const slugJson = await slugRes.json().catch(() => ({}));
      if (!slugRes.ok) throw new Error(slugJson.error || 'That Web Address Is Not Available.');

      if (displayName.trim().length >= 2) {
        // Best-effort display name; a 6-month cooldown collision should not block onboarding.
        await fetch('/api/agent/storefront-name', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_name: displayName.trim() }) }).catch(() => null);
      }
      onDone();
    } catch (e) { setErr(e instanceof Error ? e.message : 'Save Failed'); setBusy(false); }
  };

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
      <Field label="Display Name (Shown On Your Store)">
        <input style={inputStyle} value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Your Store Name" />
      </Field>
      <ErrorLine msg={err} />
      <PrimaryButton onClick={submit} busy={busy}>Save And Continue</PrimaryButton>
    </div>
  );
}

function ProductsTutorialStep({ state, onDone }: { state: OnboardingState; onDone: () => void }) {
  const isSuper = state.role === 'super_agent';
  const [markup, setMarkup] = useState(String(state.markup.default_pct ?? 0));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

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
        blurb="Every Product Has A Wholesale Cost. Your Markup Is Added On Top Of That Cost To Set The Retail Price Your Researchers Pay. The Difference Is Your Profit." />

      <div style={{ padding: 'var(--space-4, 16px)', borderRadius: 10, background: 'rgba(0,196,188,0.06)', border: '1px solid rgba(0,196,188,0.22)', marginBottom: 'var(--space-4, 16px)' }}>
        <div style={{ fontSize: '0.82rem', color: 'var(--grey-200, #D0DAE4)', lineHeight: 1.6 }}>
          <strong style={{ color: 'var(--white)' }}>Example:</strong> A Product That Costs You $20 Wholesale, With A {markup || '0'}% Markup, Sells For{' '}
          <strong style={{ color: 'var(--teal)' }}>${(20 * (1 + (Number(markup) || 0) / 100)).toFixed(2)}</strong>. You Keep The Difference.
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

function DownstreamStep({ state, onDone }: { state: OnboardingState; onDone: () => void }) {
  const isSuper = state.role === 'super_agent';
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const ack = async () => {
    setBusy(true); setErr(null);
    try { await postOnboarding({ action: 'ack', key: 'downstream_tutorial' }); onDone(); }
    catch (e) { setErr(e instanceof Error ? e.message : 'Save Failed'); setBusy(false); }
  };

  if (isSuper) {
    return (
      <div>
        <StepIntro icon={Percent} title="Set Your Agent Markup"
          blurb="As A Super Agent, You Decide The Markup Your Agents Pay On Top Of Wholesale Cost. You Can Assign A Standard Markup Tier Or A Custom Markup To Each Agent." />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 'var(--space-4, 16px)' }}>
          <InfoRow icon={Users} title="Per-Agent Control" body="From Your Agents Page You Can Open Any Agent And Set Their Markup Tier Or A Custom Markup Just For Them." />
          <InfoRow icon={Tag} title="Markup, Not Commission" body="Agents Earn The Spread Between The Price They Pay You And The Price They Charge Their Researchers. You Set The Markup They Pay." />
        </div>
        <p style={{ fontSize: '0.8rem', color: 'var(--grey-400)', lineHeight: 1.5 }}>
          You Can Do This Anytime From The Agents Section Of Your Dashboard. There Is Nothing To Set Until You Have Added Agents.
        </p>
        <ErrorLine msg={err} />
        <PrimaryButton onClick={ack} busy={busy}>I Understand, Continue</PrimaryButton>
      </div>
    );
  }

  // Regular agent setting sub-agent commissions.
  return (
    <div>
      <StepIntro icon={Percent} title="Set Your Sub-Agent Commissions"
        blurb="Sub-Agents Sell On Your Storefront And Earn A Commission On Every Sale They Bring In. You Choose Their Commission Rate." />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 'var(--space-4, 16px)' }}>
        <InfoRow icon={Percent} title="A Share Of Sales, Not A Markup" body="A Sub-Agent's Commission Is A Percentage Of The Sales They Generate -- It Is Paid Out Of Your Margin, It Does Not Raise The Researcher's Price." />
        <InfoRow icon={Users} title="Default Or Custom" body="You Can Use The Default Commission Rate Or Set A Custom Percentage For Each Sub-Agent, Up To The 40% Maximum." />
      </div>
      <p style={{ fontSize: '0.8rem', color: 'var(--grey-400)', lineHeight: 1.5 }}>
        You Set Each Sub-Agent Commission From The Sub-Agents Section Of Your Dashboard. There Is Nothing To Set Until You Have Added Sub-Agents.
      </p>
      <ErrorLine msg={err} />
      <PrimaryButton onClick={ack} busy={busy}>I Understand, Continue</PrimaryButton>
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
