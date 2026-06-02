'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  LifeBuoy,
  X,
  ChevronUp,
  Loader2,
  BellRing,
  StickyNote,
  Package,
  ZapOff,
} from 'lucide-react';

/**
 * Admin Customer Support widget — v3.
 *
 * Visible only on /messenger to a user whose profile.role === 'admin'.
 * Renders a fixed bottom-anchored bar with a slim teal accent line, a
 * lifebuoy badge anchored left, centered title + thread count, and an
 * affordance arrow on the right. Tapping it opens the support inbox panel
 * above the bar. A global rule pads `.messenger-sidebar` so the
 * conversation list rows stop above the bar (no overlap).
 */

type SupportStatus = 'open' | 'in_progress' | 'waiting_on_researcher' | 'resolved';
type FilterTab = 'all' | 'unread' | 'open' | 'snoozed' | 'resolved';

interface InboxRow {
  conversation_id: string;
  title: string | null;
  created_at: string | null;
  last_message_at: string | null;
  other_user: {
    id: string;
    full_name: string | null;
    username: string | null;
    role: string | null;
  } | null;
  last_message: {
    text: string | null;
    message_type: string | null;
    sender_id: string;
    sender_is_admin: boolean;
    created_at: string;
  } | null;
  unread_count: number;
  support_status?: SupportStatus | null;
  support_topic?: string | null;
  support_order_id?: string | null;
  support_snoozed_until?: string | null;
  is_snoozed?: boolean;
  sla_waiting_seconds?: number | null;
  internal_notes_count?: number | null;
}

function relTime(iso: string | null): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return '';
  const diff = Date.now() - then;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatShortTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '';
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function otherName(row: InboxRow): string {
  const o = row.other_user;
  if (!o) return 'Researcher';
  return (o.full_name && o.full_name.trim())
    || (o.username && o.username.trim())
    || 'Researcher';
}

function previewText(row: InboxRow): string {
  const m = row.last_message;
  if (!m) return 'No Messages Yet';
  if (m.text && m.text.trim()) {
    const prefix = m.sender_is_admin ? 'You: ' : '';
    const body = m.text.length > 90 ? `${m.text.slice(0, 87)}…` : m.text;
    return `${prefix}${body}`;
  }
  switch (m.message_type) {
    case 'image': return m.sender_is_admin ? 'You Sent A Photo' : 'Sent A Photo';
    case 'video': return m.sender_is_admin ? 'You Sent A Video' : 'Sent A Video';
    case 'voice': return m.sender_is_admin ? 'You Sent A Voice Note' : 'Sent A Voice Note';
    case 'file': return m.sender_is_admin ? 'You Sent A File' : 'Sent A File';
    default: return m.sender_is_admin ? 'You Replied' : 'New Message';
  }
}

const STATUS_LABEL: Record<SupportStatus, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  waiting_on_researcher: 'Waiting',
  resolved: 'Resolved',
};

const STATUS_COLOR: Record<SupportStatus, { bg: string; border: string; fg: string }> = {
  open: { bg: 'rgba(0,196,188,0.15)', border: 'rgba(0,196,188,0.55)', fg: '#7AF0EA' },
  in_progress: { bg: 'rgba(255,184,0,0.15)', border: 'rgba(255,184,0,0.55)', fg: '#FFD175' },
  waiting_on_researcher: { bg: 'rgba(120,140,170,0.20)', border: 'rgba(160,180,210,0.55)', fg: '#C4D0E0' },
  resolved: { bg: 'rgba(80,200,120,0.12)', border: 'rgba(80,200,120,0.55)', fg: '#9BE3B4' },
};

function StatusPill({
  status,
  onClick,
}: {
  status: SupportStatus;
  onClick: (e: React.MouseEvent) => void;
}) {
  const c = STATUS_COLOR[status];
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick(e); }}
      title="Change Status"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 8px',
        borderRadius: 999,
        background: c.bg,
        border: `1px solid ${c.border}`,
        color: c.fg,
        fontSize: '0.66rem',
        fontWeight: 800,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        lineHeight: 1.4,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      {STATUS_LABEL[status]}
    </button>
  );
}

function playChime() {
  if (typeof window === 'undefined') return;
  try {
    const AC = (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext
      || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.28);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.32);
    osc.onended = () => { try { ctx.close(); } catch {} };
  } catch {
    /* best-effort */
  }
}

export default function CustomerSupportWidget() {
  const router = useRouter();
  const [show, setShow] = useState(false);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<InboxRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<FilterTab>('all');
  const [statusPopoverFor, setStatusPopoverFor] = useState<string | null>(null);
  const [snoozePopoverFor, setSnoozePopoverFor] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null);
  const adminIdRef = useRef<string | null>(null);
  const originalTitleRef = useRef<string | null>(null);
  const prevUnreadRef = useRef<number>(-1);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!window.location.pathname.startsWith('/messenger')) return;
    let cancelled = false;
    (async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || cancelled) return;
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .maybeSingle();
        if (cancelled) return;
        if (profile?.role === 'admin') {
          adminIdRef.current = user.id;
          setShow(true);
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (originalTitleRef.current === null) {
      originalTitleRef.current = document.title.replace(/^\(\d+\)\s+/, '');
    }
  }, []);

  const fetchInbox = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch('/api/messenger/support/inbox', { cache: 'no-store' });
      if (!res.ok) {
        setErr('Could Not Load Support Inbox');
        return;
      }
      const json = await res.json();
      setRows(Array.isArray(json.conversations) ? json.conversations : []);
    } catch {
      setErr('Network Error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!show) return;
    fetchInbox();
  }, [show, fetchInbox]);

  useEffect(() => {
    if (!show) return;
    const supabase = createClient();
    const ch = supabase
      .channel('cs-widget-support')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messenger_messages' },
        () => { fetchInbox(); },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messenger_conversations' },
        () => { fetchInbox(); },
      )
      .subscribe();
    channelRef.current = ch;

    pollRef.current = setInterval(fetchInbox, 60_000);

    return () => {
      try { supabase.removeChannel(ch); } catch {}
      channelRef.current = null;
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = null;
    };
  }, [show, fetchInbox]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false);
        setStatusPopoverFor(null);
        setSnoozePopoverFor(null);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const totalUnread = rows.reduce((a, r) => a + (r.unread_count || 0), 0);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const base = originalTitleRef.current || document.title.replace(/^\(\d+\)\s+/, '');
    document.title = totalUnread > 0 ? `(${totalUnread}) ${base}` : base;

    if (prevUnreadRef.current === -1) {
      prevUnreadRef.current = totalUnread;
      return;
    }
    if (totalUnread > prevUnreadRef.current) {
      playChime();
    }
    prevUnreadRef.current = totalUnread;
  }, [totalUnread]);

  useEffect(() => {
    return () => {
      if (typeof document === 'undefined') return;
      const base = originalTitleRef.current;
      if (base) document.title = base;
    };
  }, []);

  const visibleRows = useMemo(() => {
    const sorted = [...rows].sort((a, b) => {
      const ta = a.last_message_at ? Date.parse(a.last_message_at) : 0;
      const tb = b.last_message_at ? Date.parse(b.last_message_at) : 0;
      return tb - ta;
    });
    switch (tab) {
      case 'unread':
        return sorted.filter((r) => (r.unread_count || 0) > 0);
      case 'open':
        return sorted.filter((r) =>
          (r.support_status === 'open' || r.support_status === 'in_progress' || r.support_status === 'waiting_on_researcher')
          && !r.is_snoozed,
        );
      case 'snoozed':
        return sorted.filter((r) => Boolean(r.is_snoozed));
      case 'resolved':
        return sorted.filter((r) => r.support_status === 'resolved');
      case 'all':
      default:
        return sorted.filter((r) => r.support_status !== 'resolved');
    }
  }, [rows, tab]);

  const tabCounts = useMemo(() => {
    let unread = 0, openCount = 0, snoozed = 0, resolved = 0, all = 0;
    for (const r of rows) {
      if (r.support_status !== 'resolved') all += 1;
      if ((r.unread_count || 0) > 0) unread += 1;
      if ((r.support_status === 'open' || r.support_status === 'in_progress' || r.support_status === 'waiting_on_researcher') && !r.is_snoozed) openCount += 1;
      if (r.is_snoozed) snoozed += 1;
      if (r.support_status === 'resolved') resolved += 1;
    }
    return { all, unread, open: openCount, snoozed, resolved };
  }, [rows]);

  function goToConversation(id: string) {
    setOpen(false);
    setStatusPopoverFor(null);
    setSnoozePopoverFor(null);
    router.push(`/messenger?conversation=${encodeURIComponent(id)}`);
  }

  async function setStatus(conversationId: string, status: SupportStatus) {
    setRows((prev) => prev.map((r) => r.conversation_id === conversationId ? { ...r, support_status: status } : r));
    setStatusPopoverFor(null);
    try {
      const res = await fetch(`/api/messenger/support/${encodeURIComponent(conversationId)}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) await fetchInbox();
    } catch { await fetchInbox(); }
  }

  async function snooze(conversationId: string, preset: '1h' | '4h' | 'tomorrow' | 'clear') {
    setSnoozePopoverFor(null);
    try {
      const res = await fetch(`/api/messenger/support/${encodeURIComponent(conversationId)}/snooze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preset }),
      });
      if (!res.ok) { await fetchInbox(); return; }
      await fetchInbox();
    } catch { await fetchInbox(); }
  }

  if (!show) return null;

  return (
    <>
      {open && (
        <div
          aria-hidden
          onClick={() => { setOpen(false); setStatusPopoverFor(null); setSnoozePopoverFor(null); }}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(5, 10, 15, 0.55)',
            backdropFilter: 'blur(2px)',
            zIndex: 90,
          }}
        />
      )}

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Customer Support Inbox"
          className="cs-widget-panel"
          style={{
            position: 'fixed',
            left: 0,
            right: 0,
            bottom: 64,
            zIndex: 101,
            maxHeight: 'min(60dvh, 560px)',
            display: 'flex',
            flexDirection: 'column',
            background: 'linear-gradient(180deg, #0F1923 0%, #050A0F 100%)',
            borderTop: '1px solid rgba(0, 196, 188, 0.45)',
            borderLeft: '1px solid rgba(0, 196, 188, 0.18)',
            borderRight: '1px solid rgba(0, 196, 188, 0.18)',
            borderTopLeftRadius: 14,
            borderTopRightRadius: 14,
            boxShadow: '0 -22px 48px rgba(0,0,0,0.65), 0 0 0 1px rgba(0,196,188,0.10)',
            overflow: 'hidden',
          }}
        >
          <header
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '12px 14px',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
              background:
                'linear-gradient(135deg, rgba(0,196,188,0.12) 0%, rgba(0,196,188,0.03) 100%)',
            }}
          >
            <LifeBuoy size={18} style={{ color: 'var(--teal, #00C4BC)' }} aria-hidden="true" />
            <strong style={{ color: 'var(--white, #fff)', fontSize: '0.95rem', flex: 1 }}>
              Customer Support Inbox
            </strong>
            <button
              type="button"
              onClick={() => setOpen(false)}
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

          <div
            role="tablist"
            aria-label="Support Inbox Filter"
            style={{
              display: 'flex',
              gap: 4,
              padding: '8px 10px',
              borderBottom: '1px solid rgba(255,255,255,0.05)',
              background: 'rgba(255,255,255,0.02)',
              overflowX: 'auto',
            }}
          >
            {([
              { id: 'all', label: 'All', n: tabCounts.all },
              { id: 'unread', label: 'Unread', n: tabCounts.unread },
              { id: 'open', label: 'Open', n: tabCounts.open },
              { id: 'snoozed', label: 'Snoozed', n: tabCounts.snoozed },
              { id: 'resolved', label: 'Resolved', n: tabCounts.resolved },
            ] as { id: FilterTab; label: string; n: number }[]).map((t) => {
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setTab(t.id)}
                  style={{
                    padding: '6px 10px',
                    borderRadius: 8,
                    background: active ? 'rgba(0,196,188,0.18)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${active ? 'rgba(0,196,188,0.55)' : 'rgba(255,255,255,0.08)'}`,
                    color: active ? '#7AF0EA' : 'var(--silver, #C0B8A8)',
                    fontSize: '0.74rem',
                    fontWeight: 700,
                    letterSpacing: '0.02em',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {t.label}
                  {t.n > 0 && (
                    <span style={{ marginLeft: 6, opacity: 0.85 }}>
                      {t.n > 99 ? '99+' : t.n}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div style={{ overflowY: 'auto', flex: 1 }}>
            {loading && rows.length === 0 ? (
              <div
                style={{
                  padding: '32px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  color: 'var(--silver, #C0B8A8)',
                  fontSize: '0.86rem',
                }}
              >
                <Loader2 size={16} className="spin" aria-hidden="true" />
                Loading Threads…
              </div>
            ) : err ? (
              <div
                role="alert"
                style={{
                  margin: 14,
                  padding: '10px 12px',
                  borderRadius: 8,
                  background: 'rgba(229, 62, 62, 0.10)',
                  border: '1px solid rgba(229, 62, 62, 0.35)',
                  color: '#FFAAAA',
                  fontSize: '0.82rem',
                }}
              >
                {err}
              </div>
            ) : visibleRows.length === 0 ? (
              <div
                style={{
                  padding: '36px 18px',
                  textAlign: 'center',
                  color: 'var(--silver, #C0B8A8)',
                  fontSize: '0.88rem',
                  lineHeight: 1.5,
                }}
              >
                <strong
                  style={{
                    display: 'block',
                    color: 'var(--white, #fff)',
                    fontSize: '0.95rem',
                    marginBottom: 6,
                  }}
                >
                  No Threads In This View
                </strong>
                {tab === 'all'
                  ? 'Researchers Who Click The Support Button Will Show Up Here.'
                  : 'Try A Different Filter Tab.'}
              </div>
            ) : (
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {visibleRows.map((row) => {
                  const status: SupportStatus = (row.support_status as SupportStatus) || 'open';
                  const slaSec = row.sla_waiting_seconds || 0;
                  const overdue = slaSec > 1800;
                  const slaMin = Math.floor(slaSec / 60);
                  const notesCount = row.internal_notes_count || 0;
                  const shortOrderId = row.support_order_id ? row.support_order_id.slice(0, 8) : '';

                  return (
                    <li
                      key={row.conversation_id}
                      style={{
                        borderLeft: overdue ? '4px solid #E53E3E' : '4px solid transparent',
                        position: 'relative',
                      }}
                    >
                      <div
                        onClick={() => goToConversation(row.conversation_id)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            goToConversation(row.conversation_id);
                          }
                        }}
                        style={{
                          width: '100%',
                          textAlign: 'left',
                          padding: '12px 14px',
                          background: 'transparent',
                          border: 'none',
                          borderBottom: '1px solid rgba(255,255,255,0.05)',
                          color: 'inherit',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 12,
                        }}
                      >
                        <span
                          aria-hidden
                          style={{
                            flexShrink: 0,
                            width: 38,
                            height: 38,
                            borderRadius: '50%',
                            background:
                              'linear-gradient(135deg, rgba(0,196,188,0.55) 0%, rgba(0,196,188,0.15) 100%)',
                            color: 'var(--black, #050A0F)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 800,
                            fontSize: '0.85rem',
                            letterSpacing: '0.02em',
                            textTransform: 'uppercase',
                            marginTop: 2,
                          }}
                        >
                          {otherName(row).slice(0, 2)}
                        </span>
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <span
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              gap: 8,
                            }}
                          >
                            <strong
                              style={{
                                color: 'var(--white, #fff)',
                                fontSize: '0.92rem',
                                fontWeight: row.unread_count > 0 ? 800 : 600,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {otherName(row)}
                            </strong>
                            <span
                              style={{
                                fontSize: '0.7rem',
                                color: 'var(--grey-400, #A8B4C0)',
                                flexShrink: 0,
                              }}
                            >
                              {relTime(row.last_message_at)}
                            </span>
                          </span>
                          {row.support_topic && (
                            <span
                              style={{
                                display: 'block',
                                color: '#7AF0EA',
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                letterSpacing: '0.02em',
                                marginTop: 2,
                              }}
                            >
                              {row.support_topic}
                            </span>
                          )}
                          <span
                            style={{
                              display: 'block',
                              color: row.unread_count > 0 ? 'var(--white, #fff)' : 'var(--silver, #C0B8A8)',
                              fontSize: '0.8rem',
                              marginTop: 2,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              fontWeight: row.unread_count > 0 ? 600 : 400,
                            }}
                          >
                            {previewText(row)}
                          </span>

                          <span
                            style={{
                              display: 'flex',
                              flexWrap: 'wrap',
                              alignItems: 'center',
                              gap: 6,
                              marginTop: 6,
                              position: 'relative',
                            }}
                          >
                            <span style={{ position: 'relative' }}>
                              <StatusPill
                                status={status}
                                onClick={() => setStatusPopoverFor(
                                  statusPopoverFor === row.conversation_id ? null : row.conversation_id,
                                )}
                              />
                              {statusPopoverFor === row.conversation_id && (
                                <div
                                  onClick={(e) => e.stopPropagation()}
                                  role="menu"
                                  style={{
                                    position: 'absolute',
                                    bottom: '100%',
                                    left: 0,
                                    marginBottom: 6,
                                    background: '#0F1923',
                                    border: '1px solid rgba(0,196,188,0.45)',
                                    borderRadius: 8,
                                    boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
                                    padding: 4,
                                    zIndex: 5,
                                    minWidth: 140,
                                  }}
                                >
                                  {(['open', 'in_progress', 'waiting_on_researcher', 'resolved'] as SupportStatus[]).map((s) => (
                                    <button
                                      key={s}
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); setStatus(row.conversation_id, s); }}
                                      style={{
                                        display: 'block',
                                        width: '100%',
                                        textAlign: 'left',
                                        padding: '6px 10px',
                                        background: status === s ? 'rgba(0,196,188,0.18)' : 'transparent',
                                        border: 'none',
                                        color: status === s ? '#7AF0EA' : 'var(--white, #fff)',
                                        fontSize: '0.78rem',
                                        fontWeight: 600,
                                        borderRadius: 6,
                                        cursor: 'pointer',
                                      }}
                                    >
                                      {STATUS_LABEL[s]}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </span>

                            {overdue && (
                              <span
                                title="Overdue"
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  padding: '2px 7px',
                                  borderRadius: 999,
                                  background: 'rgba(229,62,62,0.18)',
                                  border: '1px solid rgba(229,62,62,0.55)',
                                  color: '#FF9C9C',
                                  fontSize: '0.66rem',
                                  fontWeight: 800,
                                }}
                              >
                                <BellRing size={10} aria-hidden="true" />
                                Waiting {slaMin}m
                              </span>
                            )}
                            {!overdue && slaSec > 0 && (
                              <span
                                style={{
                                  color: 'var(--grey-400, #A8B4C0)',
                                  fontSize: '0.7rem',
                                  fontWeight: 600,
                                }}
                              >
                                Waiting {slaMin}m
                              </span>
                            )}

                            <span style={{ position: 'relative' }}>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSnoozePopoverFor(snoozePopoverFor === row.conversation_id ? null : row.conversation_id);
                                }}
                                title="Snooze"
                                aria-label="Snooze Thread"
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  padding: '2px 7px',
                                  borderRadius: 999,
                                  background: row.is_snoozed ? 'rgba(120,140,170,0.20)' : 'rgba(255,255,255,0.04)',
                                  border: `1px solid ${row.is_snoozed ? 'rgba(160,180,210,0.55)' : 'rgba(255,255,255,0.10)'}`,
                                  color: row.is_snoozed ? '#C4D0E0' : 'var(--silver, #C0B8A8)',
                                  fontSize: '0.66rem',
                                  fontWeight: 800,
                                  cursor: 'pointer',
                                }}
                              >
                                <ZapOff size={10} aria-hidden="true" />
                                {row.is_snoozed && row.support_snoozed_until
                                  ? `Snoozed Til ${formatShortTime(row.support_snoozed_until)}`
                                  : 'Snooze'}
                              </button>
                              {snoozePopoverFor === row.conversation_id && (
                                <div
                                  onClick={(e) => e.stopPropagation()}
                                  role="menu"
                                  style={{
                                    position: 'absolute',
                                    bottom: '100%',
                                    left: 0,
                                    marginBottom: 6,
                                    background: '#0F1923',
                                    border: '1px solid rgba(0,196,188,0.45)',
                                    borderRadius: 8,
                                    boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
                                    padding: 4,
                                    zIndex: 5,
                                    minWidth: 140,
                                  }}
                                >
                                  {([
                                    { id: '1h' as const, label: '1 Hour' },
                                    { id: '4h' as const, label: '4 Hours' },
                                    { id: 'tomorrow' as const, label: 'Tomorrow' },
                                    { id: 'clear' as const, label: 'Clear Snooze' },
                                  ]).map((opt) => (
                                    <button
                                      key={opt.id}
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); snooze(row.conversation_id, opt.id); }}
                                      style={{
                                        display: 'block',
                                        width: '100%',
                                        textAlign: 'left',
                                        padding: '6px 10px',
                                        background: 'transparent',
                                        border: 'none',
                                        color: 'var(--white, #fff)',
                                        fontSize: '0.78rem',
                                        fontWeight: 600,
                                        borderRadius: 6,
                                        cursor: 'pointer',
                                      }}
                                    >
                                      {opt.label}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </span>

                            {notesCount > 0 && (
                              <span
                                title={`${notesCount} Internal Note${notesCount === 1 ? '' : 's'}`}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 3,
                                  padding: '2px 6px',
                                  borderRadius: 999,
                                  background: 'rgba(255,184,0,0.12)',
                                  border: '1px solid rgba(255,184,0,0.40)',
                                  color: '#FFD175',
                                  fontSize: '0.66rem',
                                  fontWeight: 800,
                                }}
                              >
                                <StickyNote size={10} aria-hidden="true" />
                                {notesCount}
                              </span>
                            )}

                            {row.support_order_id && (
                              <span
                                title={`Order ${row.support_order_id}`}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 3,
                                  padding: '2px 6px',
                                  borderRadius: 999,
                                  background: 'rgba(0,196,188,0.10)',
                                  border: '1px solid rgba(0,196,188,0.35)',
                                  color: '#7AF0EA',
                                  fontSize: '0.66rem',
                                  fontWeight: 800,
                                  letterSpacing: '0.02em',
                                }}
                              >
                                <Package size={10} aria-hidden="true" />
                                Order #{shortOrderId}
                              </span>
                            )}
                          </span>
                        </span>

                        {row.unread_count > 0 && (
                          <span
                            style={{
                              flexShrink: 0,
                              minWidth: 22,
                              height: 22,
                              padding: '0 7px',
                              borderRadius: 6,
                              background: '#E53E3E',
                              color: '#fff',
                              fontSize: '0.72rem',
                              fontWeight: 800,
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              alignSelf: 'flex-start',
                              marginTop: 4,
                            }}
                          >
                            {row.unread_count > 99 ? '99+' : row.unread_count}
                          </span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <footer
            style={{
              padding: '8px 12px',
              borderTop: '1px solid rgba(255,255,255,0.06)',
              background: 'rgba(255,255,255,0.02)',
              fontSize: '0.72rem',
              color: 'var(--grey-400, #A8B4C0)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
            }}
          >
            <span>
              {visibleRows.length} Thread{visibleRows.length === 1 ? '' : 's'}
              {totalUnread > 0 ? ` · ${totalUnread} Unread` : ''}
            </span>
            <button
              type="button"
              onClick={() => fetchInbox()}
              disabled={loading}
              style={{
                background: 'transparent',
                border: '1px solid rgba(255,255,255,0.12)',
                color: 'var(--silver, #C0B8A8)',
                padding: '4px 8px',
                borderRadius: 6,
                fontSize: '0.72rem',
                cursor: loading ? 'wait' : 'pointer',
              }}
            >
              {loading ? 'Refreshing…' : 'Refresh'}
            </button>
          </footer>
        </div>
      )}

      {/* Collapsed bar — v3 design */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Close Customer Support Inbox' : 'Open Customer Support Inbox'}
        aria-expanded={open}
        title="Customer Support Inbox"
        className="cs-widget-bar"
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '10px 14px',
          paddingBottom: 'calc(10px + env(safe-area-inset-bottom))',
          minHeight: 64,
          width: '100%',
          background:
            'linear-gradient(180deg, #0E1A24 0%, #0A1219 100%)',
          color: 'var(--white, #fff)',
          border: 'none',
          borderTop: '1px solid rgba(0,196,188,0.55)',
          borderRadius: 0,
          fontSize: '0.9rem',
          fontWeight: 700,
          letterSpacing: '0.01em',
          boxShadow:
            '0 -10px 28px rgba(0,0,0,0.55), 0 -1px 0 0 rgba(0,196,188,0.15) inset',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        {/* Lifebuoy badge — glassmorphic teal */}
        <span
          aria-hidden
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 40,
            height: 40,
            borderRadius: 12,
            background:
              'linear-gradient(135deg, rgba(0,196,188,0.38) 0%, rgba(0,196,188,0.10) 100%)',
            border: '1px solid rgba(0,196,188,0.55)',
            color: '#7AF0EA',
            flexShrink: 0,
            boxShadow:
              '0 0 0 1px rgba(0,196,188,0.10), 0 6px 14px rgba(0,196,188,0.18), inset 0 1px 0 rgba(255,255,255,0.12)',
          }}
        >
          <LifeBuoy size={20} aria-hidden="true" />
        </span>

        {/* Title + meta — centered horizontally between badge and chevron */}
        <span
          style={{
            display: 'flex',
            flexDirection: 'column',
            lineHeight: 1.2,
            alignItems: 'flex-start',
            minWidth: 0,
            flex: 1,
            textAlign: 'left',
          }}
        >
          <span style={{ fontSize: '0.96rem', fontWeight: 800, color: 'var(--white, #fff)' }}>
            Customer Support
          </span>
          <span
            style={{
              fontSize: '0.74rem',
              color: totalUnread > 0 ? '#FFB4B4' : 'var(--grey-400, #A8B4C0)',
              fontWeight: totalUnread > 0 ? 700 : 500,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              marginTop: 2,
            }}
          >
            {totalUnread > 0 ? (
              <>
                <span
                  aria-hidden
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: '#E53E3E',
                    boxShadow: '0 0 6px rgba(229,62,62,0.65)',
                    display: 'inline-block',
                  }}
                />
                {`${totalUnread > 99 ? '99+' : totalUnread} Unread Thread${totalUnread === 1 ? '' : 's'}`}
              </>
            ) : (
              `${rows.length} Thread${rows.length === 1 ? '' : 's'}`
            )}
          </span>
        </span>

        {/* Unread chip + chevron — right-anchored */}
        {totalUnread > 0 && (
          <span
            aria-hidden
            style={{
              minWidth: 24,
              height: 22,
              padding: '0 8px',
              borderRadius: 7,
              background: '#E53E3E',
              color: '#fff',
              fontSize: '0.74rem',
              fontWeight: 800,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              boxShadow:
                '0 0 0 1px rgba(229,62,62,0.30), inset 0 1px 0 rgba(255,255,255,0.30)',
            }}
          >
            {totalUnread > 99 ? '99+' : totalUnread}
          </span>
        )}
        <span
          aria-hidden
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 30,
            height: 30,
            borderRadius: 8,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.10)',
            color: 'var(--silver, #C0B8A8)',
            flexShrink: 0,
            transition: 'transform 160ms ease',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        >
          <ChevronUp size={16} aria-hidden="true" />
        </span>
      </button>

      <style jsx>{`
        .spin { animation: cs-spin 1s linear infinite; }
        @keyframes cs-spin { to { transform: rotate(360deg); } }
        @media (min-width: 768px) {
          .cs-widget-bar {
            right: auto !important;
            width: 320px !important;
            border-right: 1px solid rgba(0,196,188,0.18) !important;
          }
          .cs-widget-panel {
            right: auto !important;
            width: 320px !important;
            border-right: 1px solid rgba(0, 196, 188, 0.18) !important;
          }
        }
      `}</style>
      <style jsx global>{`
        .messenger-sidebar {
          padding-bottom: calc(64px + env(safe-area-inset-bottom)) !important;
        }
      `}</style>
    </>
  );
}
