'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { LifeBuoy, X, Clock } from 'lucide-react';
import { toast } from 'sonner';

/**
 * Customer Support v2 - Floating Support Button.
 *
 * Visible only on /messenger, hidden for admin (they're the sink, not the
 * seeker). Click opens a small pre-chat topic picker modal asking for:
 *   - Topic (required): Order Issue, Payment, Product Question, Account, Other
 *   - Description (optional, 500 chars max)
 *   - Order (optional UUID; pre-filled from ?orderId= if present)
 *
 * On submit: POST /api/messenger/support/open with { topic, orderId }, then
 * send the description as the FIRST message via /api/messenger/send-message,
 * then navigate to /messenger?conversation=<id>.
 *
 * URL hook: when /messenger?openSupport=1 (optionally with &orderId=...) is
 * loaded, the picker auto-opens with the order pre-filled and topic defaulted
 * to "Order Issue". This is how the order-page CTA hands off into the flow.
 *
 * After-hours notice: when the user opens the modal outside business hours
 * in Central Time (5pm–7am Mon–Fri, or anytime Sat/Sun), an amber banner
 * sets the expectation that the reply may not come until the next business
 * day. Computed via Intl.DateTimeFormat with timeZone='America/Chicago' so
 * it's DST-correct year-round.
 */

const TOPIC_OPTIONS = [
  'Order Issue',
  'Payment',
  'Product Question',
  'Account',
  'Other',
] as const;

type Topic = typeof TOPIC_OPTIONS[number];

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s.trim());
}

/**
 * Returns true when the current moment is outside Pep Nation Lab's business
 * hours, which are 7:00am–4:59pm Monday–Friday Central Time.
 * - 5:00pm CT or later (any weekday) → after hours
 * - Before 7:00am CT (any weekday) → after hours
 * - Saturday or Sunday (any time) → after hours
 *
 * Uses Intl.DateTimeFormat with timeZone='America/Chicago' so it's DST-correct.
 * Returns false on SSR (no window) to avoid hydration mismatch - the banner
 * is a non-critical, post-mount add-on.
 */
function isAfterHoursCentral(now: Date): boolean {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Chicago',
      hour: 'numeric',
      hour12: false,
      weekday: 'short',
    }).formatToParts(now);
    const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '12');
    const weekday = parts.find((p) => p.type === 'weekday')?.value ?? '';
    if (weekday === 'Sat' || weekday === 'Sun') return true;
    return hour >= 17 || hour < 7;
  } catch {
    return false;
  }
}

function Inner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [topic, setTopic] = useState<Topic>('Order Issue');
  const [description, setDescription] = useState('');
  const [orderId, setOrderId] = useState('');
  const [didAutoOpen, setDidAutoOpen] = useState(false);
  // Re-evaluates every minute while the modal is open so a thread opened at
  // 4:59pm CT flips to the after-hours banner cleanly at 5pm without a
  // page refresh. Mounting it as state lets React render the change.
  const [nowTick, setNowTick] = useState(() => Date.now());

  useEffect(() => {
    if (!modalOpen) return;
    const handle = setInterval(() => setNowTick(Date.now()), 60_000);
    return () => clearInterval(handle);
  }, [modalOpen]);

  const afterHours = useMemo(() => isAfterHoursCentral(new Date(nowTick)), [nowTick]);

  // uplineId: if the user has a parent agent / referring agent, they should
  // message them directly via a regular DM instead of a formal support ticket.
  const [uplineId, setUplineId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!pathname || !pathname.startsWith('/messenger')) {
      setShow(false); // eslint-disable-line react-hooks/set-state-in-effect
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || cancelled) return;
        const { data: profile } = await supabase
          .from('profiles')
          .select('role, parent_agent_id, referring_agent_id, referring_sub_agent_id')
          .eq('id', user.id)
          .maybeSingle();
        if (cancelled) return;
        if (profile?.role === 'admin') {
          setShow(false);
          return;
        }
        // If this user has a network upline, store it so we can route their
        // "Support" click to a regular DM instead of a formal ticket queue.
        const upline =
          (profile as any)?.parent_agent_id ||
          (profile as any)?.referring_agent_id ||
          (profile as any)?.referring_sub_agent_id ||
          null;
        setUplineId(upline);
        setShow(true);
      } catch {
        setShow(false);
      }
    })();
    return () => { cancelled = true; };
  }, [pathname]);


  // Honor URL params: openSupport=1 + optional orderId pre-fills + auto-opens.
  useEffect(() => {
    if (!show || didAutoOpen || !searchParams) return;
    const openFlag = searchParams.get('openSupport');
    const orderQ = searchParams.get('orderId');
    if (openFlag === '1') {
      setTimeout(() => {
        setTopic('Order Issue');
        if (orderQ) setOrderId(orderQ);
        setModalOpen(true);
        setDidAutoOpen(true);
      }, 0);
    } else if (orderQ && !modalOpen) {
      // Just pre-fill the field without forcing the modal open.
      setTimeout(() => {
        setOrderId(orderQ);
      }, 0);
    }
  }, [show, didAutoOpen, searchParams, modalOpen]);

  // ESC closes the modal.
  useEffect(() => {
    if (!modalOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setModalOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modalOpen]);

  const onOpenModal = useCallback(async () => {
    if (busy) return;

    // If this user has a network upline, skip the support ticket entirely
    // and open a regular direct message with them instead.
    if (uplineId) {
      setBusy(true);
      try {
        const res = await fetch('/api/messenger/start-conversation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'direct', participantIds: [uplineId] }),
        });
        const json = await res.json();
        if (!res.ok) {
          toast.error(json.error || 'Could Not Open Conversation');
          return;
        }
        router.push(`/messenger?conversation=${encodeURIComponent(json.conversationId)}`);
      } catch {
        toast.error('Network Error');
      } finally {
        setBusy(false);
      }
      return;
    }

    // No upline — show the formal support topic picker.
    setModalOpen(true);
  }, [busy, uplineId, router]);


  const onSubmit = useCallback(async () => {
    if (busy) return;
    if (!topic) {
      toast.error('Please Pick A Topic');
      return;
    }
    const trimmedOrderId = orderId.trim();
    if (trimmedOrderId && !isUuid(trimmedOrderId)) {
      toast.error('Order Id Must Be A Valid UUID');
      return;
    }
    const trimmedDesc = description.trim().slice(0, 500);

    setBusy(true);
    try {
      const res = await fetch('/api/messenger/support/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic,
          orderId: trimmedOrderId || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || 'Failed To Open Support');
        return;
      }
      const conversationId: string = json.conversationId;

      // If description provided, send it as the first message.
      if (trimmedDesc.length > 0 && conversationId) {
        try {
          const supabase = createClient();
          const clientMessageId = (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
            ? crypto.randomUUID()
            : undefined;
          await fetch('/api/messenger/send-message', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              conversationId,
              text: trimmedDesc,
              messageType: 'text',
              ...(clientMessageId ? { clientMessageId } : {}),
            }),
          });
          // Realtime will pick this up - no need to read response.
          void supabase;
        } catch {
          // Description send is best-effort; the conversation is already open.
        }
      }

      setModalOpen(false);
      setDescription('');
      // After-hours nudge: if the researcher submitted outside business
      // hours, surface the reply-time expectation as a toast so they see it
      // after the redirect lands them in the thread.
      if (afterHours) {
        toast(
          'Thanks - Your Support Thread Is Open. Requests After 5pm Central Typically Get Answered The Next Business Day.',
          { duration: 7000 },
        );
      }
      router.push(`/messenger?conversation=${encodeURIComponent(conversationId)}`);
    } catch {
      toast.error('Network Error');
    } finally {
      setBusy(false);
    }
  }, [busy, topic, orderId, description, router, afterHours]);

  if (!show) return null;

  return (
    <>
      <button
        type="button"
        onClick={onOpenModal}
        disabled={busy}
        aria-label="Contact Pep Nation Support"
        title="Contact Pep Nation Support"
        style={{
          position: 'fixed',
          right: 'max(16px, env(safe-area-inset-right))',
          bottom: 'calc(max(16px, env(safe-area-inset-bottom)) + 64px)',
          zIndex: 80,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 14px',
          borderRadius: 999,
          background: 'var(--teal, #00C4BC)',
          color: '#000',
          border: 0,
          fontSize: '0.85rem',
          fontWeight: 700,
          boxShadow: '0 4px 16px rgba(0,196,188,0.35)',
          cursor: busy ? 'wait' : 'pointer',
          opacity: busy ? 0.7 : 1,
        }}
      >
        <LifeBuoy size={16} aria-hidden="true" />
        Support
      </button>

      {modalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Contact Support"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 250,
            background: 'rgba(5, 10, 15, 0.66)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 'max(16px, env(safe-area-inset-bottom))',
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setModalOpen(false); }}
        >
          <div
            className="glass-panel"
            style={{
              width: 'min(420px, 100%)',
              background: 'linear-gradient(180deg, #0F1923 0%, #1D2D3E 100%)',
              border: '1px solid #C0B8A8',
              borderRadius: 14,
              boxShadow:
                '0 22px 48px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.10), inset 0 -2px 4px rgba(0,0,0,0.45)',
              color: 'var(--white, #fff)',
              overflow: 'hidden',
            }}
          >
            <header
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '14px 16px',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
                background:
                  'linear-gradient(135deg, rgba(0,196,188,0.14) 0%, rgba(0,196,188,0.02) 100%)',
              }}
            >
              <LifeBuoy size={18} style={{ color: 'var(--teal, #00C4BC)' }} aria-hidden="true" />
              <strong style={{ flex: 1, fontSize: '0.98rem' }}>Contact Support</strong>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                aria-label="Close"
                style={{
                  width: 28,
                  height: 28,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 8,
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  color: 'var(--silver, #C0B8A8)',
                  cursor: 'pointer',
                }}
              >
                <X size={14} aria-hidden="true" />
              </button>
            </header>

            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* After-hours notice: appears at the top of the form when the
                  current moment is outside business hours in Central Time. */}
              {afterHours && (
                <div
                  role="status"
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 10,
                    padding: '10px 12px',
                    borderRadius: 8,
                    background: 'rgba(255,184,0,0.10)',
                    border: '1px solid rgba(255,184,0,0.45)',
                    color: '#FFD175',
                    fontSize: '0.82rem',
                    lineHeight: 1.45,
                  }}
                >
                  <Clock size={16} aria-hidden="true" style={{ flexShrink: 0, marginTop: 1 }} />
                  <span>
                    <strong style={{ color: '#FFE9B7', display: 'block', marginBottom: 2 }}>
                      Outside Business Hours
                    </strong>
                    Requests Received After 5pm Central Typically Get Answered The Next Business Day. Your Thread Will Still Be Created - We Will Reply As Soon As We Are Back.
                  </span>
                </div>
              )}

              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--silver, #C0B8A8)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  Topic
                </span>
                <select
                  value={topic}
                  onChange={(e) => setTopic(e.target.value as Topic)}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 8,
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    color: 'var(--white, #fff)',
                    fontSize: '0.92rem',
                    fontWeight: 600,
                    outline: 'none',
                  }}
                >
                  {TOPIC_OPTIONS.map((t) => (
                    <option key={t} value={t} style={{ background: '#0F1923' }}>{t}</option>
                  ))}
                </select>
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--silver, #C0B8A8)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  Description (Optional)
                </span>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value.slice(0, 500))}
                  rows={4}
                  maxLength={500}
                  placeholder="What's This About?"
                  style={{
                    padding: '10px 12px',
                    borderRadius: 8,
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    color: 'var(--white, #fff)',
                    fontSize: '0.9rem',
                    lineHeight: 1.4,
                    outline: 'none',
                    resize: 'vertical',
                    boxSizing: 'border-box',
                  }}
                />
                <span style={{ fontSize: '0.66rem', color: 'var(--silver, #C0B8A8)', textAlign: 'right' }}>
                  {description.length}/500
                </span>
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--silver, #C0B8A8)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  Order (Optional)
                </span>
                <input
                  type="text"
                  value={orderId}
                  onChange={(e) => setOrderId(e.target.value)}
                  placeholder="Order UUID"
                  style={{
                    padding: '10px 12px',
                    borderRadius: 8,
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.12)',
                    color: 'var(--white, #fff)',
                    fontSize: '0.86rem',
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </label>
            </div>

            <footer
              style={{
                padding: '12px 16px',
                borderTop: '1px solid rgba(255,255,255,0.06)',
                background: 'rgba(255,255,255,0.02)',
                display: 'flex',
                gap: 8,
                justifyContent: 'flex-end',
              }}
            >
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                disabled={busy}
                style={{
                  padding: '9px 14px',
                  borderRadius: 8,
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  color: 'var(--silver, #C0B8A8)',
                  fontSize: '0.84rem',
                  fontWeight: 700,
                  cursor: busy ? 'not-allowed' : 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={onSubmit}
                disabled={busy}
                style={{
                  padding: '9px 16px',
                  borderRadius: 8,
                  background: busy ? 'rgba(0,196,188,0.55)' : 'var(--teal, #00C4BC)',
                  border: 0,
                  color: '#000',
                  fontSize: '0.84rem',
                  fontWeight: 800,
                  cursor: busy ? 'wait' : 'pointer',
                  opacity: busy ? 0.85 : 1,
                }}
              >
                {busy ? 'Opening…' : 'Start Support Thread'}
              </button>
            </footer>
          </div>
        </div>
      )}
    </>
  );
}

export default function SupportButton() {
  return (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  );
}
