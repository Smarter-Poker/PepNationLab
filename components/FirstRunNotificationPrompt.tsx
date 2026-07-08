'use client';

/**
 * FirstRunNotificationPrompt
 *
 * A one-time, post-sign-in modal that asks the user to turn on push
 * notifications (real device enrollment via enablePush), then nudges them to
 * finish setting up their account. Shows once per (account + device) - tracked
 * in localStorage keyed by user id - and only when push is actually supported
 * and not already enabled on this device. iOS only exposes PushManager inside
 * the installed home-screen app, so in a plain Safari tab this self-suppresses.
 *
 * It is rendered globally from the root layout, so it must NOT fire on the
 * onboarding wizard (the wizard owns the notifications step there) - otherwise
 * a new agent gets two competing notification prompts at once.
 *
 * Rendered as a real HTML dialog with real buttons - an earlier version painted
 * a PNG with invisible click "hitboxes" positioned by percentage, which
 * misaligned on desktop and made the Enable button effectively unclickable.
 */

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { BellRing, BellOff, CheckCircle2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { isWebPushSupported, notificationPermission, enablePush } from '@/lib/push-client';

export default function FirstRunNotificationPrompt() {
  const router = useRouter();
  const pathname = usePathname();
  const [show, setShow] = useState(false);
  const [uid, setUid] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [enabled, setEnabled] = useState(false);
  // Browser-level notification permission is 'denied' for this site: the Enable
  // button can no longer prompt, so we show unblock instructions instead.
  const [blocked, setBlocked] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The onboarding wizard has its own notifications step; never double-prompt there.
  // The public landing page ("/") must always show the artwork unobstructed --
  // the prompt waits until the visitor is inside the app.
  const onOnboarding = (pathname || '').startsWith('/onboarding');
  const onLanding = pathname === '/';

  useEffect(() => {
    if (onOnboarding || onLanding) return;
    let cancelled = false;
    const supabase = createClient();
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const u = session?.user?.id;
      if (!u || cancelled) return;
      setUid(u);

      const key = `pnl_firstrun_notif_${u}`;
      let done = false;
      try { done = !!localStorage.getItem(key); } catch { /* ignore */ }
      if (done) return;

      // Not a push-capable surface (e.g. iOS Safari tab, not the installed app).
      if (!isWebPushSupported()) {
        try { localStorage.setItem(key, '1'); } catch { /* ignore */ }
        return;
      }

      // Already enabled on this device → never prompt.
      if (notificationPermission() === 'granted') {
        try {
          const reg = await navigator.serviceWorker.getRegistration('/sw.js');
          const sub = reg ? await reg.pushManager.getSubscription() : null;
          if (sub) {
            try { localStorage.setItem(key, '1'); } catch { /* ignore */ }
            return;
          }
        } catch { /* fall through and prompt */ }
      }

      // Best-effort role for the "finish setup" link target.
      try {
        const { data: prof } = await supabase.from('profiles').select('role').eq('id', u).maybeSingle();
        if (!cancelled) setRole((prof?.role as string) ?? null);
      } catch { /* ignore */ }

      if (!cancelled) {
        setBlocked(notificationPermission() === 'denied');
        setShow(true);
      }
    })();
    return () => { cancelled = true; };
  }, [onOnboarding, onLanding]);

  const markDone = () => {
    if (!uid) return;
    try { localStorage.setItem(`pnl_firstrun_notif_${uid}`, '1'); } catch { /* ignore */ }
  };

  const onEnable = async () => {
    setBusy(true);
    setError(null);
    const r = await enablePush();
    setBusy(false);
    if (r.ok) {
      setEnabled(true);
      markDone();
    } else {
      setError(r.error || 'Could Not Turn On Notifications. You Can Try Again Later From Settings.');
    }
  };

  const onClose = () => {
    markDone();
    setShow(false);
  };

  if (onOnboarding || onLanding || !show) return null;

  const setupHref =
    role === 'admin' ? '/admin'
    : role === 'agent' || role === 'super_agent' ? '/dashboard/agent'
    : '/account';

  const goSetup = () => {
    onClose();
    router.push(setupHref);
  };

  const cardStyle: React.CSSProperties = {
    width: '100%', maxWidth: 460, borderRadius: 18, padding: 'var(--space-7, 28px)',
    textAlign: 'center',
  };
  const primaryBtn: React.CSSProperties = {
    width: '100%', marginTop: 'var(--space-4, 16px)', fontSize: '0.95rem',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={enabled ? "You're All Set" : blocked ? 'Notifications Are Blocked' : 'Turn On Notifications'}
      style={{
        position: 'fixed', inset: 0, zIndex: 3000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16, background: 'rgba(3,8,15,0.82)', backdropFilter: 'blur(4px)',
      }}
    >
      <div className="glass-panel stagger-fade-in" style={cardStyle}>
        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 56, height: 56, borderRadius: '50%', background: 'rgba(0,196,188,0.14)', border: '1px solid rgba(0,196,188,0.4)', color: 'var(--teal)', marginBottom: 'var(--space-4, 16px)' }}>
          {enabled ? <CheckCircle2 size={28} /> : blocked ? <BellOff size={28} /> : <BellRing size={28} />}
        </div>

        {!enabled && blocked ? (
          <>
            <h2 style={{ fontSize: '1.4rem', color: 'var(--white)', margin: '0 0 8px' }}>Notifications Are Blocked</h2>
            <p style={{ fontSize: '0.9rem', color: 'var(--grey-300)', lineHeight: 1.55, margin: '0 auto', maxWidth: 380 }}>
              Your Browser Has Blocked Notifications For This Site, So We Cannot Ask For Permission Here. To Turn Them On:
            </p>
            <ol style={{ textAlign: 'left', fontSize: '0.85rem', color: 'var(--grey-300)', lineHeight: 1.6, margin: '14px auto 0', maxWidth: 340, paddingLeft: 20 }}>
              <li>Click The Site Settings Icon On The Left Of The Address Bar.</li>
              <li>Find Notifications And Set It To Allow.</li>
              <li>Reload This Page And Try Again.</li>
            </ol>
            <button
              type="button"
              onClick={onClose}
              style={{ ...primaryBtn, marginTop: 'var(--space-5, 20px)' }}
              className="btn btn-primary"
            >
              Got It
            </button>
          </>
        ) : !enabled ? (
          <>
            <h2 style={{ fontSize: '1.4rem', color: 'var(--white)', margin: '0 0 8px' }}>Turn On Notifications</h2>
            <p style={{ fontSize: '0.9rem', color: 'var(--grey-300)', lineHeight: 1.55, margin: '0 auto', maxWidth: 380 }}>
              Get Alerts On This Device For New Orders, Payments, And Messages. When Your Browser Asks, Choose Allow.
            </p>
            {error && (
              <p style={{ color: 'var(--danger, #E53E3E)', fontSize: '0.82rem', marginTop: 12 }}>{error}</p>
            )}
            <button type="button" className="btn btn-primary" onClick={onEnable} disabled={busy} style={primaryBtn}>
              {busy ? 'Turning On...' : 'Enable Notifications'}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              style={{ width: '100%', marginTop: 10, background: 'transparent', border: 'none', color: 'var(--grey-400)', cursor: 'pointer', fontSize: '0.85rem' }}
            >
              Not Now
            </button>
          </>
        ) : (
          <>
            <h2 style={{ fontSize: '1.4rem', color: 'var(--white)', margin: '0 0 8px' }}>You&apos;re All Set</h2>
            <p style={{ fontSize: '0.9rem', color: 'var(--grey-300)', lineHeight: 1.55, margin: '0 auto', maxWidth: 380 }}>
              Notifications Are On For This Device. You Can Manage Them Anytime From Your Account Settings.
            </p>
            <button type="button" className="btn btn-primary" onClick={goSetup} style={primaryBtn}>
              Finish Setting Up My Account
            </button>
            <button
              type="button"
              onClick={onClose}
              style={{ width: '100%', marginTop: 10, background: 'transparent', border: 'none', color: 'var(--grey-400)', cursor: 'pointer', fontSize: '0.85rem' }}
            >
              Done
            </button>
          </>
        )}
      </div>
    </div>
  );
}
