'use client';

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  X,
  ChevronUp,
  Loader2,
  BellRing,
  StickyNote,
  Package,
  ZapOff,
  PanelLeftOpen,
  PanelLeftClose,
  Info,
  CheckCircle2,
  LifeBuoy,
  Clock,
} from 'lucide-react';
import { toast } from 'sonner';
import { useMessengerStore } from '@/stores/messengerStore';
import MessagePane from './MessagePane';
import SupportContextSidebar from './SupportContextSidebar';

/**
 * Admin Customer Support widget - v7 (full-screen modal).
 *
 * Visible only on /messenger to a user whose profile.role === 'admin'.
 * Bottom bar opens a fixed inset:0 overlay that mounts the real messenger
 * MessagePane in the center column, so admin gets the full feature set -
 * text, photos, videos, voice, files, links, calls, threads, reactions,
 * pins, expiry - for free, by reuse. Emoji + schedule-send buttons are
 * intentionally hidden inside the modal (see global CSS at the bottom).
 *
 * v7: when a single thread is focused, the Researcher Context expands to
 * fill the rest of the left column directly under the contact card.
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
    id: string;
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

const NICKEL_BORDER = 'rgba(192,184,168,0.55)';
const NICKEL_SOFT = 'rgba(192,184,168,0.22)';

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
  in_progress: { bg: 'rgba(255,255,255,0.06)', border: 'rgba(255,255,255,0.18)', fg: 'var(--white, #fff)' },
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

function CustomerSupportWidgetInner() {
  const router = useRouter();
  // Shared messenger store. Setting activeConversationId here makes the
  // embedded <MessagePane /> render the support thread inside the modal,
  // exactly like the main /messenger view does.
  const setMessengerActive = useMessengerStore((s) => s.setActive);
  const messengerActiveId = useMessengerStore((s) => s.activeConversationId);
  const prevActiveBeforeOpenRef = useRef<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [contextCollapsed, setContextCollapsed] = useState(false);
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

  const [profile, setProfile] = useState<{ role: string | null } | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [topic, setTopic] = useState<Topic>('Order Issue');
  const [description, setDescription] = useState('');
  const [orderId, setOrderId] = useState('');
  const [didAutoOpen, setDidAutoOpen] = useState(false);
  const [nowTick, setNowTick] = useState(() => Date.now());

  const searchParams = useSearchParams();
  const pathname = usePathname();
  const conversations = useMessengerStore((s) => s.conversations);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!window.location.pathname.startsWith('/messenger')) return;
    let cancelled = false;
    (async () => {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || cancelled) return;
        const { data: prof } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .maybeSingle();
        if (cancelled) return;
        if (prof) {
          setProfile(prof);
          if (prof.role === 'admin') {
            adminIdRef.current = user.id;
          }
          setShow(true);
        }
      } catch {}
    })();
    return () => { cancelled = true; };
  }, []);

  const clearQueryParams = useCallback(() => {
    if (typeof window === 'undefined' || !searchParams) return;
    const params = new URLSearchParams(searchParams.toString());
    params.delete('openSupport');
    params.delete('orderId');
    const qs = params.toString();
    router.replace(qs ? `/messenger?${qs}` : '/messenger', { scroll: false });
  }, [router, searchParams]);

  const handleCloseModal = useCallback(() => {
    setModalOpen(false);
    clearQueryParams();
  }, [clearQueryParams]);

  // ESC closes the modal.
  useEffect(() => {
    if (!modalOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') handleCloseModal();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modalOpen, handleCloseModal]);

  // Keep after-hours central clock ticking
  useEffect(() => {
    if (!modalOpen) return;
    const handle = setInterval(() => setNowTick(Date.now()), 60_000);
    return () => clearInterval(handle);
  }, [modalOpen]);

  const afterHours = useMemo(() => isAfterHoursCentral(new Date(nowTick)), [nowTick]);

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

  // clearQueryParams and handleCloseModal are declared earlier (before the ESC useEffect).

  const supportConv = useMemo(() => {
    return conversations.find((c) => c.counterparty_role === 'admin');
  }, [conversations]);

  const handleNonAdminClick = useCallback(() => {
    if (supportConv) {
      setMessengerActive(supportConv.conversation_id);
    } else {
      setModalOpen(true);
    }
  }, [supportConv, setMessengerActive]);

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
          void supabase;
        } catch {}
      }

      setModalOpen(false);
      setDescription('');
      clearQueryParams();

      if (afterHours) {
        toast(
          'Thanks - Your Support Thread Is Open. Requests After 5pm Central Typically Get Answered The Next Business Day.',
          { duration: 7000 },
        );
      }

      try {
        const cRes = await fetch('/api/messenger/get-conversations', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ parentId: null }),
        });
        if (cRes.ok) {
          const cJson = await cRes.json();
          if (Array.isArray(cJson.conversations)) {
            useMessengerStore.getState().setConversations(cJson.conversations);
          }
        }
      } catch {}

      setMessengerActive(conversationId);
    } catch {
      toast.error('Network Error');
    } finally {
      setBusy(false);
    }
  }, [busy, topic, orderId, description, afterHours, clearQueryParams, setMessengerActive]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (originalTitleRef.current === null) {
      originalTitleRef.current = document.title.replace(/^\(\d+\)\s+/, '');
    }
  }, []);

  // Force the unread badge to 0 for whichever conversation is currently
  // active in the messenger store. The server sometimes returns a stale
  // unread_count for a conversation the admin is actively viewing - e.g.
  // when realtime fires fetchInbox INSIDE MessagePane's 1s mark-read
  // debounce window. This helper guarantees the UI never re-lights the
  // red chip on the thread the admin is looking at, even on subsequent
  // fetches.
  const applyInboxRows = useCallback((incoming: InboxRow[]) => {
    const activeId = useMessengerStore.getState().activeConversationId;
    setRows(incoming.map((r) => (
      activeId && r.conversation_id === activeId && (r.unread_count ?? 0) > 0
        ? { ...r, unread_count: 0 }
        : r
    )));
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
      applyInboxRows(Array.isArray(json.conversations) ? json.conversations : []);
    } catch {
      setErr('Network Error');
    } finally {
      setLoading(false);
    }
  }, [applyInboxRows]);

  // Synchronously mark a support thread read on the server. Uses the
  // last_message.id surfaced by /api/messenger/support/inbox so we no
  // longer rely on MessagePane's 1s debounced mark-read (which lost races
  // against realtime fetchInbox callbacks). Optimistic UI clear first,
  // then network call.
  const markRowRead = useCallback(async (conversationId: string) => {
    let lastMsgId: string | null = null;
    setRows((prev) => {
      const next = prev.map((r) => {
        if (r.conversation_id !== conversationId) return r;
        if (r.last_message?.id) lastMsgId = r.last_message.id;
        return (r.unread_count ?? 0) > 0 ? { ...r, unread_count: 0 } : r;
      });
      return next;
    });
    if (!lastMsgId) return;
    try {
      await fetch('/api/messenger/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId, lastReadMessageId: lastMsgId }),
      });
    } catch { /* best-effort - next inbox poll will reconcile */ }
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

    // Realtime (above) is the primary freshness mechanism; this interval is a
    // fallback ONLY for silently-dropped realtime connections, so 5 minutes
    // is plenty (was 60s, which just duplicated the subscription's work).
    pollRef.current = setInterval(fetchInbox, 300_000);

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
        setMessengerActive(prevActiveBeforeOpenRef.current);
        prevActiveBeforeOpenRef.current = null;
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, setMessengerActive]);

  // Snapshot the messenger's active conversation when the modal opens so we
  // can restore it on close. Capturing on the rising edge of `open`.
  useEffect(() => {
    if (open) {
      prevActiveBeforeOpenRef.current = useMessengerStore.getState().activeConversationId;
    }
    // We intentionally do NOT auto-restore on `open=false` here; the explicit
    // close paths (X button, Escape, backdrop) handle restoration so a
    // researcher who clicked into a thread doesn't lose their context.
  }, [open]);

  const totalUnread = rows.reduce((a, r) => a + (r.unread_count || 0), 0);

  // Hard isolation: the set of conversation IDs that live in this inbox.
  // The center MessagePane only renders when the active conversation is in
  // this set - non-support threads (e.g., the main messenger's prior active
  // conversation) are blocked from leaking into the Customer Support modal.
  const supportThreadIds = useMemo(
    () => new Set(rows.map((r) => r.conversation_id)),
    [rows],
  );

  // First-time auto-open: when the modal opens and the rows have loaded,
  // immediately select the most-recent support thread so the user never
  // sees a blank center pane or - worse - the main messenger's previous
  // active conversation flashing through. Triggers exactly once per open.
  const autoOpenedThisCycleRef = useRef(false);
  useEffect(() => {
    if (!open) {
      autoOpenedThisCycleRef.current = false;
      return;
    }
    if (autoOpenedThisCycleRef.current) return;
    if (rows.length === 0) return;
    const currentActive = useMessengerStore.getState().activeConversationId;
    const currentIsSupport = currentActive && rows.some((r) => r.conversation_id === currentActive);
    if (!currentIsSupport) {
      // Pick the first unread, else the most recent.
      const target =
        rows.find((r) => (r.unread_count || 0) > 0)?.conversation_id ??
        rows[0]?.conversation_id ??
        null;
      if (target) {
        setMessengerActive(target);
        // Auto-open path bypasses goToConversation, so fire mark-read here
        // explicitly - otherwise the auto-opened thread keeps its unread
        // badge lit even though the admin is actively viewing it.
        void markRowRead(target);
      }
    }
    autoOpenedThisCycleRef.current = true;
  }, [open, rows, setMessengerActive, markRowRead]);


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

  // When a support thread is selected, the left column collapses to ONLY
  // show that customer's row + their researcher context. Click "All Threads"
  // in the new header strip to expand the full list back.
  const focusedRow = useMemo(() => {
    if (!messengerActiveId) return null;
    return visibleRows.find((r) => r.conversation_id === messengerActiveId) ?? null;
  }, [visibleRows, messengerActiveId]);
  const focusedList = focusedRow ? [focusedRow] : visibleRows;

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
    // Stay in the full-screen modal - set active in the shared store so the
    // embedded MessagePane renders this support thread. Closing the modal
    // restores the messenger's previous active conversation.
    setStatusPopoverFor(null);
    setSnoozePopoverFor(null);
    setMessengerActive(id);
    setContextCollapsed(false);
    // Fire mark-read SYNCHRONOUSLY (optimistic UI + server POST). Replaces
    // the prior approach which relied on MessagePane's 1s debounced mark-read
    // and lost races against realtime fetchInbox callbacks.
    void markRowRead(id);
  }

  async function setStatus(conversationId: string, status: SupportStatus) {
    // Resolving a thread also clears its unread badge - the admin has
    // explicitly worked the conversation, so no point keeping the red chip.
    setRows((prev) => prev.map((r) => {
      if (r.conversation_id !== conversationId) return r;
      const next = { ...r, support_status: status } as InboxRow;
      if (status === 'resolved') next.unread_count = 0;
      return next;
    }));
    setStatusPopoverFor(null);
    if (status === 'resolved') {
      void markRowRead(conversationId);
    }
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

  const isAdmin = profile?.role === 'admin';

  if (!isAdmin) {
    const totalUnreadNonAdmin = supportConv?.unread_count ?? 0;
    const isThreadActive = supportConv && messengerActiveId === supportConv.conversation_id;

    return (
      <>
        {/* Support Pre-chat modal (for researchers) */}
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
            onClick={(e) => { if (e.target === e.currentTarget) handleCloseModal(); }}
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
                  onClick={handleCloseModal}
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
                  onClick={handleCloseModal}
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

        {/* Collapsed bar (visually identical to admin) */}
        <button
          type="button"
          onClick={handleNonAdminClick}
          aria-label="Contact Customer Support"
          title="Contact Customer Support"
          className="cs-widget-bar"
          style={{
            position: 'fixed',
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '10px 56px',
            paddingBottom: 'calc(10px + env(safe-area-inset-bottom))',
            minHeight: 60,
            width: '100%',
            background: 'linear-gradient(180deg, #0E1A24 0%, #0A1219 100%)',
            color: 'var(--white, #fff)',
            border: 'none',
            borderTop: `1px solid ${NICKEL_BORDER}`,
            borderRadius: 0,
            fontSize: '0.9rem',
            fontWeight: 700,
            letterSpacing: '0.01em',
            boxShadow: '0 -10px 28px rgba(0,0,0,0.55)',
            cursor: 'pointer',
            textAlign: 'center',
          }}
        >
          <span
            style={{
              display: 'flex',
              flexDirection: 'column',
              lineHeight: 1.2,
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: 0,
              textAlign: 'center',
            }}
          >
            <span style={{ fontSize: '0.96rem', fontWeight: 800, color: 'var(--white, #fff)' }}>
              Customer Support
            </span>
            <span
              style={{
                fontSize: '0.74rem',
                color: totalUnreadNonAdmin > 0 ? '#FFB4B4' : 'var(--grey-400, #A8B4C0)',
                fontWeight: totalUnreadNonAdmin > 0 ? 700 : 500,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                marginTop: 2,
              }}
            >
              {supportConv ? (
                totalUnreadNonAdmin > 0 ? (
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
                    {`${totalUnreadNonAdmin > 99 ? '99+' : totalUnreadNonAdmin} Unread Thread${totalUnreadNonAdmin === 1 ? '' : 's'}`}
                  </>
                ) : (
                  '1 Thread'
                )
              ) : (
                '0 Threads'
              )}
            </span>
          </span>

          {totalUnreadNonAdmin > 0 && (
            <span
              aria-hidden
              style={{
                position: 'absolute',
                right: 50,
                top: '50%',
                transform: 'translateY(-50%)',
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
              {totalUnreadNonAdmin > 99 ? '99+' : totalUnreadNonAdmin}
            </span>
          )}

          <span
            aria-hidden
            style={{
              position: 'absolute',
              right: 14,
              top: '50%',
              transform: isThreadActive
                ? 'translateY(-50%) rotate(180deg)'
                : 'translateY(-50%) rotate(0deg)',
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
            }}
          >
            <ChevronUp size={16} aria-hidden="true" />
          </span>
        </button>

        <style jsx>{`
          @media (min-width: 768px) {
            .cs-widget-bar {
              right: auto !important;
              width: 320px !important;
              border-right: 1px solid ${NICKEL_SOFT} !important;
            }
          }
        `}</style>
        <style jsx global>{`
          .messenger-sidebar {
            padding-bottom: calc(60px + env(safe-area-inset-bottom)) !important;
          }
        `}</style>
      </>
    );
  }

  return (
    <>
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Customer Support Inbox"
          className="cs-widget-overlay"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1500,
            display: 'flex',
            flexDirection: 'column',
            background: 'var(--surface-0, #050A0F)',
          }}
        >
          {/* Top app-bar: title + close - close returns to the collapsed bar. */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '12px 16px',
              paddingTop: 'calc(12px + env(safe-area-inset-top))',
              borderBottom: `1px solid ${NICKEL_BORDER}`,
              background: 'linear-gradient(180deg, #0E1A24 0%, #0A1219 100%)',
              flexShrink: 0,
              position: 'relative',
            }}
          >
            <button
              type="button"
              onClick={() => setSidebarCollapsed((v) => !v)}
              aria-label={sidebarCollapsed ? 'Show Inbox List' : 'Hide Inbox List'}
              title={sidebarCollapsed ? 'Show Inbox List' : 'Hide Inbox List'}
              style={{
                width: 34,
                height: 34,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 8,
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.12)',
                color: 'var(--silver, #C0B8A8)',
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              {sidebarCollapsed ? <PanelLeftOpen size={16} aria-hidden="true" /> : <PanelLeftClose size={16} aria-hidden="true" />}
            </button>
            <strong style={{ color: 'var(--white, #fff)', fontSize: '1.02rem', flex: 1, textAlign: 'center', position: 'absolute', left: 0, right: 0, pointerEvents: 'none' }}>
              Customer Support
            </strong>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setStatusPopoverFor(null);
                setSnoozePopoverFor(null);
                setMessengerActive(prevActiveBeforeOpenRef.current);
                prevActiveBeforeOpenRef.current = null;
              }}
              aria-label="Close Customer Support"
              title="Close Customer Support"
              style={{
                width: 34,
                height: 34,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 8,
                background: 'rgba(229,62,62,0.10)',
                border: '1px solid rgba(229,62,62,0.35)',
                color: '#FF9C9C',
                cursor: 'pointer',
                flexShrink: 0,
                marginLeft: 'auto',
              }}
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>

          {/* Two-column row: left aside (inbox list + researcher context) and center messages pane. */}
          <div style={{ flex: 1, display: 'flex', minHeight: 0, position: 'relative' }}>
            {!sidebarCollapsed && (
              <aside
                className="cs-widget-panel"
                style={{
                  width: 'min(360px, 90vw)',
                  flexShrink: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  background: 'linear-gradient(180deg, #0F1923 0%, #050A0F 100%)',
                  borderRight: `1px solid ${NICKEL_SOFT}`,
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
              background: 'rgba(255,255,255,0.02)',
              flexShrink: 0,
            }}
          >
            <strong style={{ color: 'var(--white, #fff)', fontSize: '0.95rem', flex: 1 }}>
              Customer Support Inbox
            </strong>
            <button
              type="button"
              onClick={() => setSidebarCollapsed(true)}
              aria-label="Hide Inbox List"
              title="Hide Inbox List"
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
              <PanelLeftClose size={14} aria-hidden="true" />
            </button>
          </header>

          {/* Filter tabs - equal-width flex, tighter font, no scroll bar */}
          <div
            role="tablist"
            aria-label="Support Inbox Filter"
            style={{
              display: 'flex',
              gap: 4,
              padding: '8px 8px',
              borderBottom: '1px solid rgba(255,255,255,0.05)',
              background: 'rgba(255,255,255,0.02)',
              overflow: 'hidden',
              flexShrink: 0,
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
                  id={`cs-filter-tab-${t.id}`}
                  aria-selected={active}
                  aria-controls="cs-thread-list"
                  onClick={() => setTab(t.id)}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    padding: '5px 4px',
                    borderRadius: 7,
                    background: active ? 'rgba(192,184,168,0.18)' : 'rgba(255,255,255,0.04)',
                    border: `1px solid ${active ? NICKEL_BORDER : 'rgba(255,255,255,0.08)'}`,
                    color: active ? 'var(--white, #fff)' : 'var(--silver, #C0B8A8)',
                    fontSize: '0.66rem',
                    fontWeight: 700,
                    letterSpacing: '0.01em',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 4,
                  }}
                >
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.label}</span>
                  {t.n > 0 && (
                    <span style={{ opacity: 0.85 }}>
                      {t.n > 99 ? '99+' : t.n}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {focusedRow && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
                padding: '8px 12px',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
                background: 'rgba(0,196,188,0.04)',
                fontSize: '0.74rem',
                flexShrink: 0,
              }}
            >
              <span style={{ color: 'var(--silver, #C0B8A8)', whiteSpace: 'nowrap' }}>
                Viewing Single Thread
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                {focusedRow.support_status !== 'resolved' && (
                  <button
                    type="button"
                    onClick={async () => {
                      await setStatus(focusedRow.conversation_id, 'resolved');
                      setMessengerActive(null);
                    }}
                    title="Mark This Thread Resolved And Return To The Inbox"
                    style={{
                      background: 'rgba(80,200,120,0.18)',
                      border: '1px solid rgba(80,200,120,0.55)',
                      color: '#9BE3B4',
                      padding: '4px 10px',
                      borderRadius: 6,
                      fontSize: '0.72rem',
                      fontWeight: 800,
                      letterSpacing: '0.02em',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    <CheckCircle2 size={13} aria-hidden="true" />
                    Mark Resolved
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setMessengerActive(null)}
                  style={{
                    background: 'transparent',
                    border: '1px solid rgba(255,255,255,0.12)',
                    color: 'var(--white, #fff)',
                    padding: '4px 10px',
                    borderRadius: 6,
                    fontSize: '0.72rem',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  ← All Threads
                </button>
              </div>
            </div>
          )}
          <div id="cs-thread-list" style={focusedRow ? { flex: '0 0 auto', overflow: 'visible' } : { overflowY: 'auto', flex: 1, minHeight: 0 }}>
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
                {focusedList.map((row) => {
                  const status: SupportStatus = (row.support_status as SupportStatus) || 'open';
                  const slaSec = row.sla_waiting_seconds || 0;
                  const overdue = slaSec > 1800;
                  const slaMin = Math.floor(slaSec / 60);
                  const notesCount = row.internal_notes_count || 0;
                  const shortOrderId = row.support_order_id ? row.support_order_id.slice(0, 8) : '';
                  const isActiveRow = messengerActiveId === row.conversation_id;

                  return (
                    <li
                      key={row.conversation_id}
                      style={{
                        borderLeft: overdue ? '4px solid #E53E3E' : '4px solid transparent',
                        position: 'relative',
                        background: isActiveRow ? 'rgba(192,184,168,0.10)' : 'transparent',
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
                              'linear-gradient(135deg, rgba(192,184,168,0.45) 0%, rgba(192,184,168,0.12) 100%)',
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
                                color: 'var(--silver, #C0B8A8)',
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
                                    border: `1px solid ${NICKEL_BORDER}`,
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
                                        background: status === s ? 'rgba(192,184,168,0.18)' : 'transparent',
                                        border: 'none',
                                        color: 'var(--white, #fff)',
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
                                    border: `1px solid ${NICKEL_BORDER}`,
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
                                  background: 'rgba(255,255,255,0.06)',
                                  border: '1px solid rgba(255,255,255,0.20)',
                                  color: 'var(--white, #fff)',
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
                                  background: 'rgba(192,184,168,0.12)',
                                  border: '1px solid rgba(192,184,168,0.35)',
                                  color: 'var(--silver, #C0B8A8)',
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

          {/* Footer pinned with flex-shrink:0 - only shows when the full list is visible.
              In focused (single-thread) mode we hide it so the Researcher Context can
              consume all remaining space below the contact card. */}
          {!focusedRow && (
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
              flexShrink: 0,
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
          )}

          {/* Researcher Context - was a separate right-rail panel; now lives
              INSIDE the left column. Only shows when a support thread is
              selected. Collapsible via the same `contextCollapsed` state so
              the inbox list gets the full column height when hidden. */}
          {messengerActiveId && supportThreadIds.has(messengerActiveId) && (
            <div
              style={{
                borderTop: `1px solid ${NICKEL_SOFT}`,
                background: 'rgba(255,255,255,0.02)',
                display: 'flex',
                flexDirection: 'column',
                // When a thread is focused (single-row mode) the Researcher
                // Context expands to fill all remaining column space.
                // Otherwise it sits at the bottom capped to 46% so the inbox
                // list stays legible.
                ...(focusedRow
                  ? { flex: '1 1 0', minHeight: 0 }
                  : { flexShrink: 0, maxHeight: contextCollapsed ? 44 : '46%', minHeight: 44 }),
                overflow: 'hidden',
                transition: 'max-height 0.18s ease',
              }}
            >
              <button
                type="button"
                onClick={() => setContextCollapsed((v) => !v)}
                aria-expanded={!contextCollapsed}
                aria-controls="cs-left-context"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                  padding: '10px 14px',
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--white, #fff)',
                  fontWeight: 600,
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <Info size={14} aria-hidden="true" />
                  Researcher Context
                </span>
                <span aria-hidden="true" style={{ color: 'var(--silver, #C0B8A8)', fontSize: '0.78rem' }}>
                  {contextCollapsed ? '▴' : '▾'}
                </span>
              </button>
              {!contextCollapsed && (
                <div
                  id="cs-left-context"
                  style={{
                    flex: 1,
                    overflowY: 'auto',
                    overflowX: 'hidden',
                    padding: '0 4px 8px',
                  }}
                >
                  <SupportContextSidebar conversationId={messengerActiveId} inline hideOwnHeader />
                </div>
              )}
            </div>
          )}
              </aside>
            )}

            {/* CENTER: messages pane (uses the shared messenger store). */}
            <main
              style={{
                flex: 1,
                minWidth: 0,
                display: 'flex',
                flexDirection: 'column',
                background: 'var(--surface-1, #0F1923)',
              }}
            >
              {messengerActiveId && adminIdRef.current && supportThreadIds.has(messengerActiveId) ? (
                <MessagePane userId={adminIdRef.current} />
              ) : (
                <div
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexDirection: 'column',
                    gap: 8,
                    padding: 24,
                    color: 'var(--silver, #C0B8A8)',
                    textAlign: 'center',
                  }}
                >
                  <strong style={{ color: 'var(--white, #fff)', fontSize: '1rem' }}>
                    No Conversation Selected
                  </strong>
                  <p style={{ fontSize: '0.86rem', maxWidth: 380, lineHeight: 1.5, margin: 0 }}>
                    Pick A Support Thread From The Left To Open It Here. You&apos;ll
                    Get The Full Messenger - Text, Photos, Videos, Voice Notes,
                    Files, And Links - Without Leaving Customer Support.
                  </p>
                </div>
              )}
            </main>

            {/* right_rail_removed - context now lives inside the left column. */}
          </div>
        </div>
      )}

      {/* Collapsed bar - brushed-nickel top edge, no decorative icon, title centered.
            Right-side cluster (unread chip + chevron) is absolutely positioned so the
            title stays geometrically centered regardless of its width. */}
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
          justifyContent: 'center',
          padding: '10px 56px',
          paddingBottom: 'calc(10px + env(safe-area-inset-bottom))',
          minHeight: 60,
          width: '100%',
          background: 'linear-gradient(180deg, #0E1A24 0%, #0A1219 100%)',
          color: 'var(--white, #fff)',
          border: 'none',
          borderTop: `1px solid ${NICKEL_BORDER}`,
          borderRadius: 0,
          fontSize: '0.9rem',
          fontWeight: 700,
          letterSpacing: '0.01em',
          boxShadow: '0 -10px 28px rgba(0,0,0,0.55)',
          cursor: 'pointer',
          textAlign: 'center',
        }}
      >
        <span
          style={{
            display: 'flex',
            flexDirection: 'column',
            lineHeight: 1.2,
            alignItems: 'center',
            justifyContent: 'center',
            minWidth: 0,
            textAlign: 'center',
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
              justifyContent: 'center',
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

        {totalUnread > 0 && (
          <span
            aria-hidden
            style={{
              position: 'absolute',
              right: 50,
              top: '50%',
              transform: 'translateY(-50%)',
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
            position: 'absolute',
            right: 14,
            top: '50%',
            transform: open
              ? 'translateY(-50%) rotate(180deg)'
              : 'translateY(-50%) rotate(0deg)',
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
            border-right: 1px solid ${NICKEL_SOFT} !important;
          }
        }
      `}</style>
      <style jsx global>{`
        .messenger-sidebar {
          padding-bottom: calc(60px + env(safe-area-inset-bottom)) !important;
        }
        /* Customer Support v6: hide the composer's emoji + schedule-send buttons
           while the modal is open. Admins reply through the support modal
           with text/photo/video/file only - emoji and scheduled-send are
           noise here. The selectors target the composer buttons by their
           stable aria-labels so we don't need to fork MessageComposer. */
        .cs-widget-overlay button[aria-label="Insert Emoji"],
        .cs-widget-overlay button[aria-label="Add Emoji"],
        .cs-widget-overlay button[aria-label="Schedule Send"] {
          display: none !important;
        }
      `}</style>
    </>
  );
}

export default function CustomerSupportWidget() {
  return (
    <Suspense fallback={null}>
      <CustomerSupportWidgetInner />
    </Suspense>
  );
}
