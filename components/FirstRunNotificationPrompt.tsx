'use client';

/**
 * FirstRunNotificationPrompt
 *
 * A one-time, post-sign-in modal that asks the user to turn on push
 * notifications (real device enrollment via enablePush), then nudges them to
 * finish setting up their account. Shows once per (account + device) — tracked
 * in localStorage keyed by user id — and only when push is actually supported
 * and not already enabled on this device. iOS only exposes PushManager inside
 * the installed home-screen app, so in a plain Safari tab this self-suppresses.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { isWebPushSupported, notificationPermission, enablePush } from '@/lib/push-client';

export default function FirstRunNotificationPrompt() {
  const [show, setShow] = useState(false);
  const [uid, setUid] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
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

      if (!cancelled) setShow(true);
    })();
    return () => { cancelled = true; };
  }, []);

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
      setError(r.error || 'Could Not Enable Notifications. You Can Try Again From Settings.');
    }
  };

  const onClose = () => {
    markDone();
    setShow(false);
  };

  if (!show) return null;

  const setupHref =
    role === 'admin' ? '/admin'
    : role === 'agent' || role === 'super_agent' ? '/dashboard/agent'
    : '/account';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Enable Notifications"
      style={{
        position: 'fixed', inset: 0, zIndex: 3000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16, background: 'rgba(3,8,15,0.82)', backdropFilter: 'blur(4px)',
      }}
    >
      <div
        className={!enabled ? "stagger-fade-in" : "card-metal stagger-fade-in"}
        style={{ width: '100%', maxWidth: 420, padding: !enabled ? 0 : 'var(--space-7, 28px)', textAlign: 'center', borderRadius: 18 }}
      >
        {!enabled ? (
          <div style={{ position: 'relative', width: '100%', filter: 'drop-shadow(0 20px 40px rgba(0,0,0,0.6))' }}>
            <img 
              src="/images/enable-notifications-dynamic.png" 
              alt="Turn On Notifications" 
              style={{ width: '100%', height: 'auto', display: 'block' }} 
            />
            {/* Hitbox for Enable Notifications */}
            <button 
              type="button" 
              onClick={onEnable} 
              disabled={busy} 
              aria-label="Enable Notifications"
              style={{ 
                position: 'absolute', 
                top: '59%', 
                left: '12%', 
                width: '76%', 
                height: '14%', 
                background: 'transparent', 
                border: 'none', 
                cursor: 'pointer',
                outline: 'none',
              }}
            />
            {/* Hitbox for Not Now */}
            <button 
              type="button" 
              onClick={onClose} 
              aria-label="Not Now"
              style={{ 
                position: 'absolute', 
                top: '75%', 
                left: '12%', 
                width: '76%', 
                height: '14%', 
                background: 'transparent', 
                border: 'none', 
                cursor: 'pointer',
                outline: 'none'
              }}
            />
          </div>
        ) : (
          <>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--white)', margin: '0 0 8px' }}>
              You&apos;re All Set
            </h2>
            <p style={{ fontSize: '0.9rem', color: 'var(--silver)', lineHeight: 1.6, margin: '0 0 var(--space-5, 22px)' }}>
              Notifications Are On For This Device. Next, Finish Setting Up Your Account.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2, 10px)' }}>
              <Link href={setupHref} onClick={onClose} className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                Finish Setting Up My Account
              </Link>
              <button type="button" onClick={onClose} className="btn btn-ghost btn-sm" style={{ width: '100%', justifyContent: 'center', color: 'var(--grey-400)' }}>
                Done
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
