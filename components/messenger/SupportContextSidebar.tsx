'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import SupportInternalNotes from '@/components/messenger/SupportInternalNotes';
import {
  User,
  Package,
  Wallet,
  ShoppingCart,
  Link as LinkIcon,
  Clock,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

/**
 * Customer Support v2 — Researcher Context Sidebar.
 *
 * Admin-only right-rail panel that surfaces the researcher's profile,
 * lifetime spend, recent orders, the linked order (if support_order_id
 * is set on the conversation), the cart snapshot, the referring agent,
 * and the topic line — plus the internal-notes panel for the active
 * support thread. Self-gates on:
 *   - admin role
 *   - conversation.is_support === true
 *
 * Renders nothing when any gate fails. Pulls from
 * /api/messenger/support/[id]/context which already returns the full
 * payload the support flow needs.
 *
 * Layout modes:
 *   - default (inline=false / unset): legacy fixed-position right rail.
 *   - inline=true: renders as a plain block — used when mounted inside
 *     the Customer Support widget's left column.
 */

interface ContextPayload {
  conversation?: {
    id: string;
    is_support?: boolean;
    support_topic?: string | null;
    support_first_response_at?: string | null;
    support_order_id?: string | null;
  };
  researcher?: {
    id: string;
    full_name: string | null;
    username: string | null;
    role: string | null;
    is_super_agent?: boolean | null;
    is_sub_agent?: boolean | null;
    email: string | null;
    created_at: string | null;
    last_sign_in_at: string | null;
  };
  referring_agent?: {
    id: string;
    full_name: string | null;
    slug: string | null;
  } | null;
  lifetime?: {
    total_spent: number;
    order_count: number;
  };
  linked_order?: {
    id: string;
    status: string;
    total: number;
    created_at: string;
    tracking_number?: string | null;
    tracking_url?: string | null;
  } | null;
  recent_orders?: Array<{
    id: string;
    status: string;
    total: number;
    created_at: string;
  }>;
  cart?: {
    item_count: number;
    subtotal: number;
  } | null;
}

function dollars(n: number | null | undefined): string {
  const v = Number.isFinite(n as number) ? Number(n) : 0;
  return `$${v.toFixed(2)}`;
}

function shortDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '—';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || '')
    .join('') || 'R';
}

/**
 * Resolve a single human-friendly role label from a profile's role enum +
 * the is_super_agent / is_sub_agent flags. Super agents in this codebase
 * have role='agent' AND is_super_agent=true, so the flags are the authority.
 */
function resolveRoleLabel(researcher: ContextPayload['researcher']): string | null {
  if (!researcher) return null;
  if (researcher.is_super_agent === true) return 'Super Agent';
  if (researcher.is_sub_agent === true) return 'Sub Agent';
  const role = (researcher.role || '').toLowerCase();
  switch (role) {
    case 'admin':
      return 'Admin';
    case 'agent':
      return 'Agent';
    case 'researcher':
      return 'Researcher';
    case 'super_agent':
      return 'Super Agent';
    case 'sub_agent':
      return 'Sub Agent';
    default:
      if (!role) return null;
      // Fallback: title-case the unknown role with spaces.
      return role
        .replace(/_/g, ' ')
        .split(' ')
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
  }
}

function StatusPill({ status }: { status: string }) {
  const lower = (status || '').toLowerCase();
  const palette: Record<string, { bg: string; border: string; fg: string }> = {
    delivered: { bg: 'rgba(80,200,120,0.12)', border: 'rgba(80,200,120,0.55)', fg: '#9BE3B4' },
    shipped: { bg: 'rgba(0,196,188,0.12)', border: 'rgba(0,196,188,0.55)', fg: '#7AF0EA' },
    approved_ship: { bg: 'rgba(0,196,188,0.12)', border: 'rgba(0,196,188,0.55)', fg: '#7AF0EA' },
    approved_pickup: { bg: 'rgba(0,196,188,0.12)', border: 'rgba(0,196,188,0.55)', fg: '#7AF0EA' },
    in_fulfillment: { bg: 'rgba(255,184,0,0.12)', border: 'rgba(255,184,0,0.45)', fg: '#FFD175' },
    agent_approval_pending: { bg: 'rgba(255,184,0,0.12)', border: 'rgba(255,184,0,0.45)', fg: '#FFD175' },
    pending_customer_payment: { bg: 'rgba(255,184,0,0.12)', border: 'rgba(255,184,0,0.45)', fg: '#FFD175' },
    cancelled: { bg: 'rgba(229,62,62,0.12)', border: 'rgba(229,62,62,0.45)', fg: '#FF9C9C' },
  };
  const c = palette[lower] || { bg: 'rgba(255,255,255,0.05)', border: 'rgba(255,255,255,0.15)', fg: '#C0B8A8' };
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 7px',
        borderRadius: 999,
        background: c.bg,
        border: `1px solid ${c.border}`,
        color: c.fg,
        fontSize: '0.66rem',
        fontWeight: 800,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
      }}
    >
      {lower.replace(/_/g, ' ') || 'Pending'}
    </span>
  );
}

interface SupportContextSidebarProps {
  conversationId: string;
  /** When true, renders as a plain in-flow block — no fixed positioning,
   *  no z-index, no maxHeight. Used by the Customer Support widget which
   *  mounts this inside its left column. */
  inline?: boolean;
  /** When true, suppress the internal header ("Researcher Context" + chevron).
   *  Used when the parent has its own collapsible header above the panel. */
  hideOwnHeader?: boolean;
}

export default function SupportContextSidebar({
  conversationId,
  inline = false,
  hideOwnHeader = false,
}: SupportContextSidebarProps) {
  const [show, setShow] = useState(false);
  const [data, setData] = useState<ContextPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Gate: admin + support conversation.
  useEffect(() => {
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
        if (profile?.role !== 'admin') return;

        setLoading(true);
        const res = await fetch(`/api/messenger/support/${encodeURIComponent(conversationId)}/context`, {
          cache: 'no-store',
        });
        if (!res.ok) return;
        const json: ContextPayload = await res.json();
        if (cancelled) return;
        if (!json.conversation?.is_support) return;
        setData(json);
        setShow(true);
      } catch {
        /* silent — sidebar just stays hidden */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [conversationId]);

  // Track viewport for mobile-vs-desktop layout.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    function check() { setIsMobile(window.innerWidth < 1024); }
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const fullName = useMemo(() => {
    const r = data?.researcher;
    if (!r) return 'Researcher';
    return (r.full_name && r.full_name.trim())
      || (r.username && r.username.trim())
      || 'Researcher';
  }, [data]);

  const roleLabel = useMemo(() => resolveRoleLabel(data?.researcher), [data]);

  if (!show || !data) return null;

  // Inline mode skips all fixed-position rules so the panel renders as a
  // plain block inside whatever container it was mounted in (e.g., the
  // Customer Support widget's left column). Default mode keeps the legacy
  // right-rail behavior for any callers still relying on it.
  const containerStyle: React.CSSProperties = inline
    ? { display: 'block', width: '100%' }
    : isMobile
      ? {
          position: 'fixed',
          top: 'calc(var(--nav-offset, 60px) + 8px)',
          right: 8,
          zIndex: 95,
          maxWidth: 'calc(100vw - 16px)',
        }
      : {
          position: 'fixed',
          right: 12,
          top: 'calc(var(--nav-offset, 60px) + 12px)',
          width: 320,
          maxHeight: 'calc(100dvh - var(--nav-offset, 60px) - 84px)',
          overflowY: 'auto',
          zIndex: 95,
        };

  const inner: React.CSSProperties = inline
    ? {
        // Inline mode is hosted by a parent that owns the chrome; we keep the
        // content padding but drop the heavy frame/border/shadow that look
        // wrong against the left-column surface.
        background: 'transparent',
        border: 'none',
        borderRadius: 0,
        boxShadow: 'none',
        overflow: 'visible',
        color: 'var(--white, #fff)',
      }
    : {
        background: 'linear-gradient(180deg, #0F1923 0%, #1D2D3E 100%)',
        border: '1px solid #C0B8A8',
        borderRadius: 12,
        boxShadow:
          '0 8px 24px rgba(0, 0, 0, 0.55), inset 0 1px 0 rgba(255,255,255,0.10), inset 0 -2px 4px rgba(0,0,0,0.45)',
        overflow: 'hidden',
        color: 'var(--white, #fff)',
      };

  return (
    <aside aria-label="Support Researcher Context" style={containerStyle}>
      <div style={inner}>
        {!hideOwnHeader && (
          <header
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 12px',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
              background:
                'linear-gradient(135deg, rgba(0,196,188,0.10) 0%, rgba(0,196,188,0.02) 100%)',
            }}
          >
            <User size={16} style={{ color: 'var(--teal, #00C4BC)' }} aria-hidden="true" />
            <strong style={{ fontSize: '0.86rem', flex: 1 }}>Researcher Context</strong>
            {isMobile && !inline && (
              <button
                type="button"
                onClick={() => setCollapsed((v) => !v)}
                aria-label={collapsed ? 'Expand' : 'Collapse'}
                style={{
                  background: 'transparent',
                  border: '1px solid rgba(255,255,255,0.10)',
                  borderRadius: 6,
                  color: 'var(--silver, #C0B8A8)',
                  width: 26,
                  height: 26,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                {collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
              </button>
            )}
          </header>
        )}

        {!collapsed && (
          <div style={{ padding: '12px' }}>
            {/* Researcher card */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <span
                aria-hidden
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: '50%',
                  background:
                    'linear-gradient(135deg, rgba(0,196,188,0.55) 0%, rgba(0,196,188,0.15) 100%)',
                  color: '#050A0F',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: '0.95rem',
                  letterSpacing: '0.02em',
                  flexShrink: 0,
                }}
              >
                {initials(fullName)}
              </span>
              <div style={{ minWidth: 0, flex: 1 }}>
                {/* Display name + role pill on the same row.
                    The pill is inline-flex so it never wraps under the name. */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    minWidth: 0,
                  }}
                >
                  <span
                    style={{
                      fontSize: '0.92rem',
                      fontWeight: 800,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      minWidth: 0,
                    }}
                  >
                    {fullName}
                  </span>
                  {roleLabel && (
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '1px 7px',
                        borderRadius: 999,
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.10)',
                        color: 'var(--silver, #C0B8A8)',
                        fontSize: '0.64rem',
                        fontWeight: 800,
                        letterSpacing: '0.04em',
                        textTransform: 'uppercase',
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                      }}
                    >
                      {roleLabel}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '0.74rem', color: 'var(--silver, #C0B8A8)' }}>
                  {data.researcher?.username ? `@${data.researcher.username}` : data.researcher?.email || ''}
                </div>
              </div>
            </div>

            {/* Quick context: topic + first response */}
            <div
              style={{
                padding: '8px 10px',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 8,
                marginBottom: 12,
                fontSize: '0.76rem',
                color: 'var(--silver, #C0B8A8)',
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
              }}
            >
              {data.conversation?.support_topic && (
                <div>
                  <span style={{ color: 'var(--white, #fff)', fontWeight: 700 }}>Topic: </span>
                  {data.conversation.support_topic}
                </div>
              )}
              <div>
                <span style={{ color: 'var(--white, #fff)', fontWeight: 700 }}>First Response: </span>
                {data.conversation?.support_first_response_at
                  ? shortDate(data.conversation.support_first_response_at)
                  : 'Not Yet Responded'}
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 2 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <Clock size={12} aria-hidden="true" />
                  Joined {shortDate(data.researcher?.created_at)}
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  Last Seen {shortDate(data.researcher?.last_sign_in_at)}
                </span>
              </div>
            </div>

            {/* Referring agent */}
            {data.referring_agent && (
              <div
                style={{
                  padding: '8px 10px',
                  borderRadius: 8,
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  marginBottom: 12,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <LinkIcon size={14} style={{ color: 'var(--teal, #00C4BC)' }} aria-hidden="true" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.74rem', color: 'var(--silver, #C0B8A8)' }}>Referring Agent</div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {data.referring_agent.slug ? (
                      <Link href={`/${data.referring_agent.slug}`} style={{ color: 'var(--white, #fff)', textDecoration: 'none' }}>
                        {data.referring_agent.full_name || data.referring_agent.slug}
                      </Link>
                    ) : (
                      data.referring_agent.full_name || 'Unknown'
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Lifetime */}
            <div
              style={{
                display: 'flex',
                gap: 8,
                marginBottom: 12,
              }}
            >
              <div
                style={{
                  flex: 1,
                  padding: '10px 12px',
                  borderRadius: 8,
                  background: 'rgba(0,196,188,0.08)',
                  border: '1px solid rgba(0,196,188,0.30)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                }}
              >
                <span style={{ fontSize: '0.66rem', color: '#7AF0EA', fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  Lifetime
                </span>
                <span style={{ fontSize: '1.05rem', fontWeight: 800 }}>
                  {dollars(data.lifetime?.total_spent)}
                </span>
                <span style={{ fontSize: '0.7rem', color: 'var(--silver, #C0B8A8)' }}>
                  Across {data.lifetime?.order_count || 0} Order{(data.lifetime?.order_count || 0) === 1 ? '' : 's'}
                </span>
              </div>
              <div
                style={{
                  flex: 1,
                  padding: '10px 12px',
                  borderRadius: 8,
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                }}
              >
                <span style={{ fontSize: '0.66rem', color: 'var(--silver, #C0B8A8)', fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  In Cart
                </span>
                <span style={{ fontSize: '1.05rem', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <ShoppingCart size={14} aria-hidden="true" />
                  {data.cart?.item_count || 0}
                </span>
                <span style={{ fontSize: '0.7rem', color: 'var(--silver, #C0B8A8)' }}>
                  {dollars(data.cart?.subtotal)}
                </span>
              </div>
            </div>

            {/* Linked order */}
            {data.linked_order && (
              <div
                style={{
                  padding: '10px 12px',
                  borderRadius: 8,
                  background: 'rgba(255,184,0,0.08)',
                  border: '1px solid rgba(255,184,0,0.30)',
                  marginBottom: 12,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <Package size={14} style={{ color: '#FFD175' }} aria-hidden="true" />
                  <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#FFD175', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                    Linked Order
                  </span>
                </div>
                <Link
                  href={`/orders/${data.linked_order.id}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                    fontSize: '0.82rem',
                    color: 'var(--white, #fff)',
                    textDecoration: 'none',
                  }}
                >
                  <span style={{ fontWeight: 700 }}>#{data.linked_order.id.slice(0, 8)}</span>
                  <StatusPill status={data.linked_order.status} />
                  <span style={{ fontWeight: 800 }}>{dollars(data.linked_order.total)}</span>
                </Link>
                {data.linked_order.tracking_number && (
                  <div style={{ marginTop: 6, fontSize: '0.74rem', color: 'var(--silver, #C0B8A8)' }}>
                    {data.linked_order.tracking_url ? (
                      <Link href={data.linked_order.tracking_url} target="_blank" rel="noopener noreferrer" style={{ color: '#7AF0EA' }}>
                        Tracking: {data.linked_order.tracking_number}
                      </Link>
                    ) : (
                      <>Tracking: {data.linked_order.tracking_number}</>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Recent 5 orders */}
            {data.recent_orders && data.recent_orders.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div
                  style={{
                    fontSize: '0.66rem',
                    color: 'var(--silver, #C0B8A8)',
                    fontWeight: 800,
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                    marginBottom: 6,
                  }}
                >
                  Recent Orders
                </div>
                <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                  {data.recent_orders.slice(0, 5).map((o) => (
                    <li key={o.id}>
                      <Link
                        href={`/orders/${o.id}`}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          padding: '8px 0',
                          borderBottom: '1px solid rgba(255,255,255,0.05)',
                          color: 'var(--white, #fff)',
                          textDecoration: 'none',
                          fontSize: '0.78rem',
                        }}
                      >
                        <span style={{ fontWeight: 700, minWidth: 70 }}>#{o.id.slice(0, 8)}</span>
                        <StatusPill status={o.status} />
                        <span style={{ marginLeft: 'auto', fontWeight: 800 }}>{dollars(o.total)}</span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--silver, #C0B8A8)' }}>
                          {shortDate(o.created_at)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Internal notes panel — admin-only, scoped to this thread */}
            <SupportInternalNotes conversationId={conversationId} />
          </div>
        )}

        {loading && (
          <div
            style={{
              padding: '6px 10px',
              fontSize: '0.7rem',
              color: 'var(--silver, #C0B8A8)',
              borderTop: '1px solid rgba(255,255,255,0.05)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Wallet size={12} aria-hidden="true" />
            Loading…
          </div>
        )}
      </div>
    </aside>
  );
}
