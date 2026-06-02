'use client';

/**
 * AgentResearcherCRMv2 — R30 Phase 3
 *
 * The "My Researchers" page rebuilt as a real CRM. Consumes the rich
 * /api/agent/researchers/v2 payload in a single round-trip.
 *
 * Surfaces:
 *  - Goal & streak header (current-month new-researcher target + progress)
 *  - 10 KPI tiles with mini sparklines + WoW delta + click-to-filter
 *  - Insight strip (at-risk count, repeat-rate, commission earned, growth nudge)
 *  - Filter chips: All / VIPs / At-Risk / New This Month / Inactive / Pinned
 *  - Rich researcher table with status badge, lifetime value, orders, last order,
 *    tags, churn risk, source, and per-row Message / Tag / Pin actions
 *  - Inline notes + tags editor in expanded row
 *  - Activity feed (collapsible)
 *  - Empty state with 3-step checklist + Copy Storefront Link
 *  - CSV export button
 *  - Mobile: stacked KPI scroll-strip + card-list rows
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Pin,
  PinOff,
  MessageSquare,
  Tag as TagIcon,
  Search,
  Download,
  Plus,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  CircleAlert,
  Sparkles,
  Target,
  Flame,
  StickyNote,
  X,
  ChevronDown,
  ChevronUp,
  Mail,
  Activity as ActivityIcon,
} from 'lucide-react';

type Status =
  | 'lead'
  | 'new'
  | 'first_order'
  | 'active'
  | 'vip'
  | 'at_risk'
  | 'churned';

interface Researcher {
  id: string;
  full_name: string | null;
  username: string | null;
  email: string | null;
  phone: string | null;
  joined_at: string;
  last_login: string | null;
  orders_count: number;
  lifetime_value: number;
  last_order_at: string | null;
  status: Status;
  churn_risk: number;
  sparkline: number[];
  tags: { id: string; tag: string; color: string | null }[];
  is_pinned: boolean;
  last_contacted_at: string | null;
  acquisition_source: string | null;
  has_open_reminder: boolean;
}

interface Kpi {
  value: number;
  spark: number[];
  delta_pct: number;
  label?: string;
}

interface Insight {
  id: string;
  kind: 'at_risk' | 'repeat_rate' | 'commission' | 'no_growth' | 'goal';
  title: string;
  body: string;
  action?: { label: string; filter?: string; href?: string };
}

interface ActivityItem {
  id: string;
  kind: 'order' | 'signup' | 'login' | 'note' | 'message';
  researcher_id: string;
  researcher_name: string;
  at: string;
  meta?: string;
}

interface Payload {
  researchers: Researcher[];
  kpis: {
    researchers_count: Kpi;
    lifetime_value: Kpi;
    total_orders: Kpi;
    active_buyers: Kpi;
    avg_order_value: Kpi;
    repeat_rate: Kpi;
    new_this_month: Kpi;
    at_risk: Kpi;
    best_customer: Kpi & { label: string };
    lifetime_commission: Kpi;
  };
  insights: Insight[];
  activity: ActivityItem[];
  goal: {
    target_count: number;
    achieved_count: number;
    progress_pct: number;
    streak_months: number;
  };
  kanban_counts: Record<Status, number>;
  source_counts: { source: string; count: number }[];
  storefront_slug: string | null;
}

type FilterKey =
  | 'all'
  | 'vip'
  | 'at_risk'
  | 'new'
  | 'inactive'
  | 'pinned'
  | 'with_reminder';

type SortKey = 'name' | 'ltv' | 'orders' | 'last' | 'joined' | 'risk';

const STATUS_STYLES: Record<
  Status,
  { label: string; bg: string; fg: string; border: string }
> = {
  lead: { label: 'Lead', bg: 'rgba(168,180,192,0.10)', fg: '#A8B4C0', border: 'rgba(168,180,192,0.40)' },
  new: { label: 'New', bg: 'rgba(96,165,250,0.12)', fg: '#60A5FA', border: 'rgba(96,165,250,0.45)' },
  first_order: { label: 'First Order', bg: 'rgba(45,212,191,0.12)', fg: '#2DD4BF', border: 'rgba(45,212,191,0.45)' },
  active: { label: 'Active', bg: 'rgba(0,196,188,0.12)', fg: '#00C4BC', border: 'rgba(0,196,188,0.45)' },
  vip: { label: 'VIP', bg: 'rgba(250,204,21,0.14)', fg: '#FACC15', border: 'rgba(250,204,21,0.55)' },
  at_risk: { label: 'At Risk', bg: 'rgba(245,158,11,0.14)', fg: '#F59E0B', border: 'rgba(245,158,11,0.50)' },
  churned: { label: 'Churned', bg: 'rgba(239,68,68,0.14)', fg: '#EF4444', border: 'rgba(239,68,68,0.50)' },
};

function fmtUSD(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n);
}

function fmtInt(n: number): string {
  return new Intl.NumberFormat('en-US').format(n);
}

function fmtPct(n: number): string {
  const v = Number.isFinite(n) ? n : 0;
  return `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;
}

function daysAgo(iso: string | null): string {
  if (!iso) return 'Never';
  const ms = Date.now() - new Date(iso).getTime();
  const d = Math.floor(ms / 86400000);
  if (d <= 0) return 'Today';
  if (d === 1) return 'Yesterday';
  if (d < 30) return `${d} Days Ago`;
  const m = Math.floor(d / 30);
  if (m < 12) return `${m} Months Ago`;
  return `${Math.floor(d / 365)} Years Ago`;
}

/**
 * Renders a compact inline SVG sparkline. Accepts an arbitrary count of points
 * and auto-fits to 60x20 viewport. Used inside KPI tiles. Renders nothing if
 * there is no signal to show — avoids visual noise on empty tiles.
 */
function Sparkline({ data, color = '#00C4BC' }: { data: number[]; color?: string }) {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const points = data
    .map((d, i) => {
      const x = (i / Math.max(data.length - 1, 1)) * 60;
      const y = 20 - ((d - min) / range) * 18 - 1;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  const area = `0,20 ${points} 60,20`;
  return (
    <svg
      viewBox="0 0 60 20"
      width="60"
      height="20"
      style={{ overflow: 'visible' }}
      aria-hidden
    >
      <polygon points={area} fill={color} opacity="0.12" />
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DeltaPill({ pct }: { pct: number }) {
  const positive = pct >= 0;
  const color = positive ? '#2DD4BF' : '#EF4444';
  const Icon = positive ? TrendingUp : TrendingDown;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 3,
        fontSize: '0.65rem',
        fontWeight: 700,
        color,
        background: `${color}1a`,
        border: `1px solid ${color}55`,
        borderRadius: 999,
        padding: '1px 6px',
      }}
    >
      <Icon size={10} aria-hidden />
      {fmtPct(pct)}
    </span>
  );
}

function KpiTile({
  label,
  value,
  spark,
  delta,
  color = '#00C4BC',
  onClick,
  subtitle,
}: {
  label: string;
  value: string;
  spark: number[];
  delta: number;
  color?: string;
  onClick?: () => void;
  subtitle?: string;
}) {
  const interactive = !!onClick;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!interactive}
      style={{
        textAlign: 'left',
        padding: '12px 14px',
        borderRadius: 14,
        background:
          'linear-gradient(180deg, rgba(22,34,48,0.95) 0%, rgba(15,25,35,0.95) 100%)',
        border: '1px solid rgba(0,196,188,0.18)',
        boxShadow: '0 1px 0 rgba(255,255,255,0.04) inset, 0 8px 18px rgba(0,0,0,0.30)',
        cursor: interactive ? 'pointer' : 'default',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        minHeight: 96,
        minWidth: 0,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <span
          style={{
            fontSize: '0.66rem',
            fontWeight: 700,
            color: '#A8B4C0',
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {label}
        </span>
        <DeltaPill pct={delta} />
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <span
          style={{
            fontSize: '1.35rem',
            fontWeight: 800,
            color: '#FFFFFF',
            lineHeight: 1.05,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            maxWidth: '100%',
          }}
        >
          {value}
        </span>
        <Sparkline data={spark} color={color} />
      </div>
      {subtitle && (
        <span style={{ fontSize: '0.7rem', color: '#D0DAE4', opacity: 0.85 }}>
          {subtitle}
        </span>
      )}
    </button>
  );
}

function StatusBadge({ status }: { status: Status }) {
  const s = STATUS_STYLES[status];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        fontSize: '0.66rem',
        fontWeight: 800,
        letterSpacing: '0.03em',
        color: s.fg,
        background: s.bg,
        border: `1px solid ${s.border}`,
        borderRadius: 999,
        padding: '2px 8px',
        textTransform: 'uppercase',
        whiteSpace: 'nowrap',
      }}
    >
      {s.label}
    </span>
  );
}

function ChurnRiskBar({ risk }: { risk: number }) {
  const pct = Math.max(0, Math.min(100, Math.round(risk)));
  const color = pct >= 70 ? '#EF4444' : pct >= 40 ? '#F59E0B' : '#2DD4BF';
  return (
    <div
      title={`Churn Risk ${pct}%`}
      style={{
        width: 56,
        height: 6,
        background: 'rgba(255,255,255,0.06)',
        borderRadius: 999,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          width: `${pct}%`,
          height: '100%',
          background: color,
          transition: 'width 200ms ease',
        }}
      />
    </div>
  );
}

function GoalHeader({
  goal,
  onSetGoal,
}: {
  goal: Payload['goal'];
  onSetGoal: () => void;
}) {
  const pct = Math.max(0, Math.min(100, Math.round(goal.progress_pct)));
  return (
    <div
      style={{
        padding: '14px 16px',
        borderRadius: 14,
        background:
          'linear-gradient(135deg, rgba(0,196,188,0.10) 0%, rgba(0,196,188,0.02) 100%)',
        border: '1px solid rgba(0,196,188,0.30)',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
        <Target size={18} color="#00C4BC" aria-hidden />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '0.74rem', color: '#A8B4C0', fontWeight: 600 }}>
            This Month Goal
          </div>
          <div style={{ fontSize: '1.05rem', color: '#FFFFFF', fontWeight: 800 }}>
            {fmtInt(goal.achieved_count)} Of {fmtInt(goal.target_count || 0)} New Researchers
          </div>
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 160, maxWidth: 360 }}>
        <div
          style={{
            position: 'relative',
            height: 8,
            background: 'rgba(255,255,255,0.06)',
            borderRadius: 999,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              width: `${pct}%`,
              background:
                'linear-gradient(90deg, #00C4BC 0%, #2DD4BF 100%)',
              transition: 'width 300ms ease',
            }}
          />
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginTop: 4,
            fontSize: '0.66rem',
            color: '#A8B4C0',
          }}
        >
          <span>{pct}% Complete</span>
          {goal.streak_months > 0 && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 3,
                color: '#F59E0B',
                fontWeight: 700,
              }}
            >
              <Flame size={11} aria-hidden /> {goal.streak_months} Month Streak
            </span>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={onSetGoal}
        style={{
          padding: '6px 12px',
          borderRadius: 8,
          background: 'rgba(0,196,188,0.10)',
          border: '1px solid rgba(0,196,188,0.40)',
          color: '#00C4BC',
          fontSize: '0.72rem',
          fontWeight: 700,
          cursor: 'pointer',
        }}
      >
        Set Goal
      </button>
    </div>
  );
}

function InsightStrip({ insights }: { insights: Insight[] }) {
  if (insights.length === 0) return null;
  const iconFor = (k: Insight['kind']) =>
    k === 'at_risk' ? (
      <AlertTriangle size={14} color="#F59E0B" aria-hidden />
    ) : k === 'repeat_rate' ? (
      <Sparkles size={14} color="#FACC15" aria-hidden />
    ) : k === 'commission' ? (
      <TrendingUp size={14} color="#2DD4BF" aria-hidden />
    ) : k === 'no_growth' ? (
      <CircleAlert size={14} color="#60A5FA" aria-hidden />
    ) : (
      <Target size={14} color="#00C4BC" aria-hidden />
    );

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: 8,
        marginTop: 12,
      }}
    >
      {insights.map((it) => (
        <div
          key={it.id}
          style={{
            padding: '10px 12px',
            borderRadius: 10,
            background: 'rgba(15,25,35,0.85)',
            border: '1px solid rgba(255,255,255,0.06)',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: '0.7rem',
              fontWeight: 700,
              color: '#D0DAE4',
            }}
          >
            {iconFor(it.kind)}
            {it.title}
          </div>
          <div style={{ fontSize: '0.74rem', color: '#A8B4C0', lineHeight: 1.35 }}>
            {it.body}
          </div>
        </div>
      ))}
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
  count,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  count?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '5px 11px',
        borderRadius: 999,
        background: active ? 'rgba(0,196,188,0.18)' : 'rgba(255,255,255,0.04)',
        border: `1px solid ${active ? 'rgba(0,196,188,0.55)' : 'rgba(255,255,255,0.10)'}`,
        color: active ? '#00C4BC' : '#D0DAE4',
        fontSize: '0.72rem',
        fontWeight: 700,
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
      {count !== undefined && (
        <span
          style={{
            background: active ? 'rgba(0,196,188,0.25)' : 'rgba(255,255,255,0.08)',
            padding: '0 6px',
            borderRadius: 999,
            fontSize: '0.65rem',
          }}
        >
          {fmtInt(count)}
        </span>
      )}
    </button>
  );
}

function EmptyState({ slug }: { slug: string | null }) {
  const storefrontUrl =
    typeof window !== 'undefined' && slug
      ? `${window.location.origin}/${slug}`
      : slug
        ? `/${slug}`
        : null;

  const onCopy = useCallback(() => {
    if (!storefrontUrl) return;
    void navigator.clipboard.writeText(storefrontUrl);
    toast.success('Storefront Link Copied');
  }, [storefrontUrl]);

  return (
    <div
      style={{
        padding: '32px 24px',
        borderRadius: 14,
        background: 'rgba(15,25,35,0.6)',
        border: '1px dashed rgba(0,196,188,0.30)',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 14,
      }}
    >
      <div style={{ fontSize: '1.05rem', color: '#FFFFFF', fontWeight: 800 }}>
        No Researchers Yet
      </div>
      <p style={{ color: '#A8B4C0', fontSize: '0.82rem', maxWidth: 460, lineHeight: 1.45 }}>
        Your CRM Will Light Up The Moment Your First Researcher Joins. Get There In Three Steps:
      </p>
      <ol
        style={{
          textAlign: 'left',
          fontSize: '0.78rem',
          color: '#D0DAE4',
          lineHeight: 1.55,
          paddingLeft: 18,
          margin: 0,
          maxWidth: 360,
        }}
      >
        <li>Share Your Storefront Link Or QR Code</li>
        <li>Onboard A Researcher From The Add Researcher Button</li>
        <li>Pin Your VIPs And Tag Your Repeat Buyers</li>
      </ol>
      {storefrontUrl && (
        <button
          type="button"
          onClick={onCopy}
          className="btn-primary"
          style={{ minHeight: 40, padding: '0 18px' }}
        >
          Copy Storefront Link
        </button>
      )}
    </div>
  );
}

function ActivityFeed({ items }: { items: ActivityItem[] }) {
  const [open, setOpen] = useState(false);
  if (items.length === 0) return null;
  const visible = open ? items : items.slice(0, 4);
  return (
    <div
      style={{
        marginTop: 16,
        padding: '12px 14px',
        borderRadius: 12,
        background: 'rgba(15,25,35,0.7)',
        border: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          background: 'transparent',
          border: 0,
          color: '#FFFFFF',
          padding: 0,
          marginBottom: 8,
          cursor: 'pointer',
        }}
      >
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontWeight: 700,
            fontSize: '0.78rem',
          }}
        >
          <ActivityIcon size={14} color="#00C4BC" aria-hidden /> Recent Activity
        </span>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {visible.map((a) => (
          <li
            key={a.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              padding: '6px 0',
              borderTop: '1px solid rgba(255,255,255,0.04)',
              fontSize: '0.74rem',
              color: '#D0DAE4',
            }}
          >
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              <strong style={{ color: '#FFFFFF' }}>{a.researcher_name}</strong> {a.meta}
            </span>
            <span style={{ color: '#A8B4C0', fontSize: '0.7rem', whiteSpace: 'nowrap' }}>
              {daysAgo(a.at)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function AgentResearcherCRMv2() {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('ltv');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const r = await fetch('/api/agent/researchers/v2', { cache: 'no-store' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = (await r.json()) as Payload;
      setData(j);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could Not Load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const onTogglePin = useCallback(
    async (r: Researcher) => {
      const method = r.is_pinned ? 'DELETE' : 'POST';
      const res = await fetch('/api/agent/researchers/pins', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ researcherId: r.id }),
      });
      if (!res.ok) {
        toast.error('Could Not Update Pin');
        return;
      }
      toast.success(r.is_pinned ? 'Pin Removed' : 'Researcher Pinned');
      void refresh();
    },
    [refresh],
  );

  const onAddTag = useCallback(
    async (r: Researcher) => {
      const tag = window.prompt('Tag For This Researcher (e.g. VIP, Discount Eligible)');
      if (!tag) return;
      const trimmed = tag.trim().slice(0, 32);
      if (!trimmed) return;
      const res = await fetch('/api/agent/researchers/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ researcherId: r.id, tag: trimmed }),
      });
      if (!res.ok) {
        toast.error('Could Not Save Tag');
        return;
      }
      toast.success('Tag Added');
      void refresh();
    },
    [refresh],
  );

  const onRemoveTag = useCallback(
    async (r: Researcher, tag: string) => {
      const res = await fetch('/api/agent/researchers/tags', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ researcherId: r.id, tag }),
      });
      if (!res.ok) {
        toast.error('Could Not Remove Tag');
        return;
      }
      void refresh();
    },
    [refresh],
  );

  const onMessage = useCallback((r: Researcher) => {
    window.location.href = `/messenger?participant=${encodeURIComponent(r.id)}`;
  }, []);

  const onSetGoal = useCallback(async () => {
    const raw = window.prompt('New Researchers Target For This Month');
    if (!raw) return;
    const n = parseInt(raw, 10);
    if (!Number.isFinite(n) || n < 0) {
      toast.error('Enter A Whole Number');
      return;
    }
    const res = await fetch('/api/agent/researchers/goals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetCount: n }),
    });
    if (!res.ok) {
      toast.error('Could Not Save Goal');
      return;
    }
    toast.success('Goal Saved');
    void refresh();
  }, [refresh]);

  const onExport = useCallback(() => {
    window.location.href = '/api/agent/researchers/export';
  }, []);

  const filtered = useMemo(() => {
    if (!data) return [];
    const term = search.trim().toLowerCase();
    const byFilter = data.researchers.filter((r) => {
      switch (filter) {
        case 'vip':
          return r.status === 'vip';
        case 'at_risk':
          return r.status === 'at_risk' || r.status === 'churned';
        case 'new':
          return r.status === 'new' || r.status === 'first_order';
        case 'inactive':
          return r.orders_count === 0;
        case 'pinned':
          return r.is_pinned;
        case 'with_reminder':
          return r.has_open_reminder;
        case 'all':
        default:
          return true;
      }
    });
    const bySearch = term
      ? byFilter.filter(
          (r) =>
            (r.full_name ?? '').toLowerCase().includes(term) ||
            (r.username ?? '').toLowerCase().includes(term) ||
            (r.email ?? '').toLowerCase().includes(term),
        )
      : byFilter;
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...bySearch].sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return (a.full_name ?? '').localeCompare(b.full_name ?? '') * dir;
        case 'orders':
          return (a.orders_count - b.orders_count) * dir;
        case 'last':
          return (
            (new Date(a.last_order_at ?? 0).getTime() -
              new Date(b.last_order_at ?? 0).getTime()) *
            dir
          );
        case 'joined':
          return (
            (new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime()) * dir
          );
        case 'risk':
          return (a.churn_risk - b.churn_risk) * dir;
        case 'ltv':
        default:
          return (a.lifetime_value - b.lifetime_value) * dir;
      }
    });
  }, [data, filter, search, sortBy, sortDir]);

  if (loading && !data) {
    return (
      <div style={{ padding: 24, color: '#A8B4C0' }}>Loading Researcher CRM...</div>
    );
  }
  if (error) {
    return (
      <div style={{ padding: 24, color: '#EF4444' }}>
        Could Not Load: {error}{' '}
        <button
          type="button"
          onClick={() => void refresh()}
          style={{
            marginLeft: 8,
            padding: '4px 10px',
            borderRadius: 6,
            background: 'rgba(0,196,188,0.10)',
            border: '1px solid rgba(0,196,188,0.40)',
            color: '#00C4BC',
            cursor: 'pointer',
          }}
        >
          Retry
        </button>
      </div>
    );
  }
  if (!data) return null;

  const k = data.kpis;
  const hasAny = data.researchers.length > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <GoalHeader goal={data.goal} onSetGoal={onSetGoal} />

      <div
        style={{
          display: 'grid',
          gap: 10,
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        }}
      >
        <KpiTile
          label="Researchers"
          value={fmtInt(k.researchers_count.value)}
          spark={k.researchers_count.spark}
          delta={k.researchers_count.delta_pct}
          onClick={() => setFilter('all')}
        />
        <KpiTile
          label="Lifetime Value"
          value={fmtUSD(k.lifetime_value.value)}
          spark={k.lifetime_value.spark}
          delta={k.lifetime_value.delta_pct}
          color="#FACC15"
        />
        <KpiTile
          label="Total Orders"
          value={fmtInt(k.total_orders.value)}
          spark={k.total_orders.spark}
          delta={k.total_orders.delta_pct}
          color="#60A5FA"
        />
        <KpiTile
          label="Active Buyers"
          value={fmtInt(k.active_buyers.value)}
          spark={k.active_buyers.spark}
          delta={k.active_buyers.delta_pct}
          onClick={() => setFilter('all')}
        />
        <KpiTile
          label="Avg Order Value"
          value={fmtUSD(k.avg_order_value.value)}
          spark={k.avg_order_value.spark}
          delta={k.avg_order_value.delta_pct}
          color="#2DD4BF"
        />
        <KpiTile
          label="Repeat Rate"
          value={`${Math.round(k.repeat_rate.value)}%`}
          spark={k.repeat_rate.spark}
          delta={k.repeat_rate.delta_pct}
          color="#A78BFA"
        />
        <KpiTile
          label="New This Month"
          value={fmtInt(k.new_this_month.value)}
          spark={k.new_this_month.spark}
          delta={k.new_this_month.delta_pct}
          onClick={() => setFilter('new')}
        />
        <KpiTile
          label="At Risk"
          value={fmtInt(k.at_risk.value)}
          spark={k.at_risk.spark}
          delta={k.at_risk.delta_pct}
          color="#F59E0B"
          onClick={() => setFilter('at_risk')}
        />
        <KpiTile
          label="Best Customer"
          value={k.best_customer.label || '—'}
          spark={k.best_customer.spark}
          delta={k.best_customer.delta_pct}
          color="#FACC15"
          subtitle={k.best_customer.value > 0 ? fmtUSD(k.best_customer.value) : undefined}
        />
        <KpiTile
          label="Commission Earned"
          value={fmtUSD(k.lifetime_commission.value)}
          spark={k.lifetime_commission.spark}
          delta={k.lifetime_commission.delta_pct}
          color="#2DD4BF"
        />
      </div>

      <InsightStrip insights={data.insights} />

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 8,
          marginTop: 6,
        }}
      >
        <FilterChip active={filter === 'all'} onClick={() => setFilter('all')} count={data.researchers.length}>
          All
        </FilterChip>
        <FilterChip
          active={filter === 'vip'}
          onClick={() => setFilter('vip')}
          count={data.kanban_counts.vip}
        >
          VIPs
        </FilterChip>
        <FilterChip
          active={filter === 'at_risk'}
          onClick={() => setFilter('at_risk')}
          count={(data.kanban_counts.at_risk ?? 0) + (data.kanban_counts.churned ?? 0)}
        >
          At Risk
        </FilterChip>
        <FilterChip
          active={filter === 'new'}
          onClick={() => setFilter('new')}
          count={(data.kanban_counts.new ?? 0) + (data.kanban_counts.first_order ?? 0)}
        >
          New
        </FilterChip>
        <FilterChip
          active={filter === 'inactive'}
          onClick={() => setFilter('inactive')}
          count={data.kanban_counts.lead}
        >
          Inactive
        </FilterChip>
        <FilterChip
          active={filter === 'pinned'}
          onClick={() => setFilter('pinned')}
          count={data.researchers.filter((r) => r.is_pinned).length}
        >
          Pinned
        </FilterChip>
        <div style={{ flex: 1 }} />
        <div
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.10)',
            borderRadius: 10,
            padding: '0 10px',
            minWidth: 200,
          }}
        >
          <Search size={14} color="#A8B4C0" aria-hidden />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search Name, Email, Username"
            style={{
              border: 0,
              background: 'transparent',
              color: '#FFFFFF',
              padding: '8px 8px',
              fontSize: '0.78rem',
              outline: 'none',
              minWidth: 0,
              width: '100%',
            }}
          />
        </div>
        <button
          type="button"
          onClick={onExport}
          className="btn-ghost"
          style={{ minHeight: 36, padding: '0 12px', display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <Download size={14} aria-hidden /> Export CSV
        </button>
      </div>

      {!hasAny ? (
        <EmptyState slug={data.storefront_slug} />
      ) : (
        <div
          style={{
            borderRadius: 12,
            border: '1px solid rgba(255,255,255,0.06)',
            background: 'rgba(15,25,35,0.6)',
            overflow: 'hidden',
          }}
        >
          <div
            role="row"
            style={{
              display: 'grid',
              gridTemplateColumns:
                'minmax(180px,1.6fr) 100px 80px 110px 100px 90px 110px',
              padding: '8px 10px',
              fontSize: '0.66rem',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              color: '#A8B4C0',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
              background: 'rgba(255,255,255,0.02)',
            }}
            className="crm-row-head"
          >
            <button
              type="button"
              onClick={() => {
                setSortBy('name');
                setSortDir((d) => (sortBy === 'name' && d === 'asc' ? 'desc' : 'asc'));
              }}
              style={{ background: 'transparent', border: 0, color: 'inherit', textAlign: 'left', cursor: 'pointer', font: 'inherit' }}
            >
              Researcher
            </button>
            <button
              type="button"
              onClick={() => {
                setSortBy('ltv');
                setSortDir((d) => (sortBy === 'ltv' && d === 'desc' ? 'asc' : 'desc'));
              }}
              style={{ background: 'transparent', border: 0, color: 'inherit', textAlign: 'right', cursor: 'pointer', font: 'inherit' }}
            >
              LTV
            </button>
            <button
              type="button"
              onClick={() => {
                setSortBy('orders');
                setSortDir((d) => (sortBy === 'orders' && d === 'desc' ? 'asc' : 'desc'));
              }}
              style={{ background: 'transparent', border: 0, color: 'inherit', textAlign: 'right', cursor: 'pointer', font: 'inherit' }}
            >
              Orders
            </button>
            <button
              type="button"
              onClick={() => {
                setSortBy('last');
                setSortDir((d) => (sortBy === 'last' && d === 'desc' ? 'asc' : 'desc'));
              }}
              style={{ background: 'transparent', border: 0, color: 'inherit', textAlign: 'left', cursor: 'pointer', font: 'inherit' }}
            >
              Last Order
            </button>
            <span>Status</span>
            <span style={{ textAlign: 'center' }}>Risk</span>
            <span style={{ textAlign: 'right' }}>Actions</span>
          </div>

          {filtered.map((r) => {
            const s = STATUS_STYLES[r.status];
            const isExpanded = expandedId === r.id;
            return (
              <div key={r.id} className="crm-row">
                <div
                  role="row"
                  style={{
                    display: 'grid',
                    gridTemplateColumns:
                      'minmax(180px,1.6fr) 100px 80px 110px 100px 90px 110px',
                    alignItems: 'center',
                    padding: '10px',
                    borderTop: '1px solid rgba(255,255,255,0.04)',
                    borderLeft: `3px solid ${s.border}`,
                    fontSize: '0.78rem',
                    color: '#E6EEF6',
                    cursor: 'pointer',
                  }}
                  onClick={() => setExpandedId((id) => (id === r.id ? null : r.id))}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                    <span
                      style={{
                        fontWeight: 700,
                        color: '#FFFFFF',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      {r.is_pinned && <Pin size={11} color="#FACC15" aria-hidden />}
                      {r.full_name || r.username || r.email || 'Researcher'}
                    </span>
                    <span style={{ fontSize: '0.68rem', color: '#A8B4C0' }}>
                      {r.email || r.username || ''}
                    </span>
                    {r.tags.length > 0 && (
                      <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {r.tags.map((t) => (
                          <span
                            key={t.id}
                            style={{
                              fontSize: '0.62rem',
                              padding: '1px 6px',
                              borderRadius: 999,
                              background: 'rgba(0,196,188,0.10)',
                              border: '1px solid rgba(0,196,188,0.30)',
                              color: '#00C4BC',
                              fontWeight: 700,
                            }}
                          >
                            {t.tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <span style={{ textAlign: 'right', fontWeight: 700, color: '#FFFFFF' }}>
                    {fmtUSD(r.lifetime_value)}
                  </span>
                  <span style={{ textAlign: 'right' }}>{fmtInt(r.orders_count)}</span>
                  <span style={{ color: '#D0DAE4' }}>{daysAgo(r.last_order_at)}</span>
                  <StatusBadge status={r.status} />
                  <span style={{ display: 'flex', justifyContent: 'center' }}>
                    <ChurnRiskBar risk={r.churn_risk} />
                  </span>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'flex-end',
                      gap: 4,
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      onClick={() => onMessage(r)}
                      title="Message"
                      className="crm-icon-btn"
                    >
                      <MessageSquare size={14} aria-hidden />
                    </button>
                    <button
                      type="button"
                      onClick={() => void onAddTag(r)}
                      title="Add Tag"
                      className="crm-icon-btn"
                    >
                      <TagIcon size={14} aria-hidden />
                    </button>
                    <button
                      type="button"
                      onClick={() => void onTogglePin(r)}
                      title={r.is_pinned ? 'Unpin' : 'Pin'}
                      className="crm-icon-btn"
                    >
                      {r.is_pinned ? <PinOff size={14} aria-hidden /> : <Pin size={14} aria-hidden />}
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div
                    style={{
                      padding: '12px 14px',
                      background: 'rgba(0,196,188,0.04)',
                      borderTop: '1px solid rgba(0,196,188,0.18)',
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                      gap: 12,
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '0.66rem', color: '#A8B4C0', fontWeight: 700, textTransform: 'uppercase' }}>Joined</div>
                      <div style={{ fontSize: '0.82rem', color: '#FFFFFF' }}>{daysAgo(r.joined_at)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.66rem', color: '#A8B4C0', fontWeight: 700, textTransform: 'uppercase' }}>Last Login</div>
                      <div style={{ fontSize: '0.82rem', color: '#FFFFFF' }}>{daysAgo(r.last_login)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.66rem', color: '#A8B4C0', fontWeight: 700, textTransform: 'uppercase' }}>Last Contacted</div>
                      <div style={{ fontSize: '0.82rem', color: '#FFFFFF' }}>{daysAgo(r.last_contacted_at)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.66rem', color: '#A8B4C0', fontWeight: 700, textTransform: 'uppercase' }}>Source</div>
                      <div style={{ fontSize: '0.82rem', color: '#FFFFFF' }}>{r.acquisition_source || 'Direct'}</div>
                    </div>
                    {r.email && (
                      <div>
                        <div style={{ fontSize: '0.66rem', color: '#A8B4C0', fontWeight: 700, textTransform: 'uppercase' }}>Email</div>
                        <a
                          href={`mailto:${r.email}`}
                          style={{
                            fontSize: '0.82rem',
                            color: '#00C4BC',
                            textDecoration: 'none',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          <Mail size={12} aria-hidden /> {r.email}
                        </a>
                      </div>
                    )}
                    {r.tags.length > 0 && (
                      <div style={{ gridColumn: '1 / -1' }}>
                        <div style={{ fontSize: '0.66rem', color: '#A8B4C0', fontWeight: 700, textTransform: 'uppercase' }}>Tags</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                          {r.tags.map((t) => (
                            <span
                              key={t.id}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                fontSize: '0.68rem',
                                padding: '2px 8px',
                                borderRadius: 999,
                                background: 'rgba(0,196,188,0.10)',
                                border: '1px solid rgba(0,196,188,0.30)',
                                color: '#00C4BC',
                                fontWeight: 700,
                              }}
                            >
                              {t.tag}
                              <button
                                type="button"
                                onClick={() => void onRemoveTag(r, t.tag)}
                                aria-label={`Remove Tag ${t.tag}`}
                                style={{
                                  background: 'transparent',
                                  border: 0,
                                  color: 'inherit',
                                  cursor: 'pointer',
                                  padding: 0,
                                  display: 'inline-flex',
                                }}
                              >
                                <X size={10} aria-hidden />
                              </button>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <ActivityFeed items={data.activity} />

      <style jsx>{`
        .crm-icon-btn {
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid rgba(255, 255, 255, 0.10);
          color: #d0dae4;
          border-radius: 8px;
          padding: 6px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 28px;
          min-height: 28px;
        }
        .crm-icon-btn:hover {
          background: rgba(0, 196, 188, 0.12);
          color: #00c4bc;
          border-color: rgba(0, 196, 188, 0.40);
        }
        @media (max-width: 640px) {
          .crm-row-head {
            display: none !important;
          }
          .crm-row > div[role='row'] {
            grid-template-columns: 1fr auto !important;
            row-gap: 4px;
          }
          .crm-row > div[role='row'] > *:nth-child(2),
          .crm-row > div[role='row'] > *:nth-child(3),
          .crm-row > div[role='row'] > *:nth-child(4),
          .crm-row > div[role='row'] > *:nth-child(5),
          .crm-row > div[role='row'] > *:nth-child(6) {
            display: none;
          }
        }
      `}</style>
    </div>
  );
}
