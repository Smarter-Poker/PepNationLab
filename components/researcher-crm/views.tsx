'use client';

/**
 * R30 Phase 4 - Advanced researcher CRM views.
 *
 * Three sibling views to the rich list table:
 *  - KanbanView: lifecycle pipeline columns (Lead → New → First Order →
 *    Active → VIP → At Risk → Churned). Each card shows name, LTV, days
 *    since last order, churn risk; drag-free for now (status is computed,
 *    not user-editable) - this is a visual pipeline, not a CRM-write tool.
 *  - ChartsView: revenue line (12 weeks), day-of-week heatmap (7×12),
 *    top customers bar (top 10 by LTV).
 *  - AcquisitionView: source attribution donut + conversion funnel
 *    (visits → signups → first orders → repeat orders).
 *
 * All views consume:
 *  (a) the rich payload already returned by /api/agent/researchers/v2 (for
 *      kanban + per-researcher fields), and
 *  (b) /api/agent/researchers/insights (for the heatmap + top customers +
 *      cohort + funnel datasets).
 */

import { useEffect, useMemo, useState } from 'react';
import {
  TrendingUp,
  Users,
  ShoppingBag,
  Sparkles,
  AlertTriangle,
} from 'lucide-react';

type Status =
  | 'lead'
  | 'new'
  | 'first_order'
  | 'active'
  | 'vip'
  | 'at_risk'
  | 'churned';

export interface KanbanResearcher {
  id: string;
  full_name: string | null;
  username: string | null;
  lifetime_value: number;
  orders_count: number;
  last_order_at: string | null;
  status: Status;
  churn_risk: number;
}

interface InsightsPayload {
  dow_heatmap: number[][];
  heatmap_weeks: number;
  top_customers: {
    id: string;
    name: string;
    lifetime_value: number;
    orders_count: number;
  }[];
  cohort_retention: {
    cohort_month: string;
    size: number;
    retained_by_month: number[];
  }[];
  funnel: {
    visits: number;
    signups: number;
    first_orders: number;
    repeat_orders: number;
  };
}

const KANBAN_ORDER: Status[] = [
  'lead',
  'new',
  'first_order',
  'active',
  'vip',
  'at_risk',
  'churned',
];

const STATUS_LABEL: Record<Status, string> = {
  lead: 'Leads',
  new: 'New',
  first_order: 'First Order',
  active: 'Active',
  vip: 'VIP',
  at_risk: 'At Risk',
  churned: 'Churned',
};

const STATUS_COLOR: Record<Status, string> = {
  lead: '#A8B4C0',
  new: '#60A5FA',
  first_order: '#2DD4BF',
  active: '#00C4BC',
  vip: '#FACC15',
  at_risk: '#F59E0B',
  churned: '#EF4444',
};

const DOW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function fmtUSD(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n);
}

function daysAgo(iso: string | null): string {
  if (!iso) return 'Never';
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (d <= 0) return 'Today';
  if (d === 1) return '1d';
  if (d < 30) return `${d}d`;
  const m = Math.floor(d / 30);
  if (m < 12) return `${m}mo`;
  return `${Math.floor(d / 365)}y`;
}

/* ============================================================================
   Kanban View
   ========================================================================== */

export function KanbanView({
  researchers,
  onCardClick,
}: {
  researchers: KanbanResearcher[];
  onCardClick: (id: string) => void;
}) {
  const grouped = useMemo(() => {
    const g: Record<Status, KanbanResearcher[]> = {
      lead: [],
      new: [],
      first_order: [],
      active: [],
      vip: [],
      at_risk: [],
      churned: [],
    };
    for (const r of researchers) g[r.status].push(r);
    for (const s of KANBAN_ORDER) {
      g[s].sort((a, b) => b.lifetime_value - a.lifetime_value);
    }
    return g;
  }, [researchers]);

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(7, minmax(180px, 1fr))',
        gap: 10,
        overflowX: 'auto',
        paddingBottom: 8,
      }}
    >
      {KANBAN_ORDER.map((status) => {
        const items = grouped[status];
        const color = STATUS_COLOR[status];
        return (
          <div
            key={status}
            style={{
              background: 'rgba(15,25,35,0.7)',
              border: '1px solid rgba(255,255,255,0.06)',
              borderTop: `3px solid ${color}`,
              borderRadius: 12,
              padding: '10px',
              minHeight: 180,
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 4,
              }}
            >
              <span
                style={{
                  fontSize: '0.7rem',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  color,
                }}
              >
                {STATUS_LABEL[status]}
              </span>
              <span
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  borderRadius: 999,
                  padding: '1px 8px',
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  color: '#D0DAE4',
                }}
              >
                {items.length}
              </span>
            </div>
            {items.length === 0 && (
              <div
                style={{
                  fontSize: '0.7rem',
                  color: '#6B7B8C',
                  fontStyle: 'italic',
                  padding: '6px 0',
                }}
              >
                Empty
              </div>
            )}
            {items.slice(0, 50).map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => onCardClick(r.id)}
                style={{
                  textAlign: 'left',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 8,
                  padding: '7px 9px',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 3,
                  color: 'inherit',
                }}
              >
                <span
                  style={{
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    color: '#FFFFFF',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {r.full_name || r.username || 'Researcher'}
                </span>
                <span
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '0.66rem',
                    color: '#A8B4C0',
                  }}
                >
                  <span style={{ color: '#FFFFFF', fontWeight: 700 }}>
                    {fmtUSD(r.lifetime_value)}
                  </span>
                  <span>{daysAgo(r.last_order_at)}</span>
                </span>
                <div
                  style={{
                    height: 3,
                    background: 'rgba(255,255,255,0.06)',
                    borderRadius: 999,
                    overflow: 'hidden',
                    marginTop: 2,
                  }}
                  title={`Churn Risk ${Math.round(r.churn_risk)}%`}
                >
                  <div
                    style={{
                      width: `${Math.max(0, Math.min(100, r.churn_risk))}%`,
                      height: '100%',
                      background:
                        r.churn_risk >= 70
                          ? '#EF4444'
                          : r.churn_risk >= 40
                            ? '#F59E0B'
                            : '#2DD4BF',
                    }}
                  />
                </div>
              </button>
            ))}
            {items.length > 50 && (
              <span style={{ fontSize: '0.66rem', color: '#A8B4C0', textAlign: 'center', padding: '4px 0' }}>
                +{items.length - 50} More
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ============================================================================
   Charts View
   ========================================================================== */

function RevenueLine({ spark }: { spark: number[] }) {
  if (!spark || spark.length === 0) {
    return (
      <div style={{ padding: 12, color: '#A8B4C0', fontSize: '0.78rem' }}>
        No Revenue Data Yet
      </div>
    );
  }
  const max = Math.max(...spark, 1);
  const W = 480;
  const H = 120;
  const pad = 8;
  const points = spark
    .map((v, i) => {
      const x = pad + (i / Math.max(spark.length - 1, 1)) * (W - pad * 2);
      const y = H - pad - (v / max) * (H - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  const area = `${pad},${H - pad} ${points} ${W - pad},${H - pad}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="120" aria-label="Revenue Trend">
      <defs>
        <linearGradient id="rev-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#00C4BC" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#00C4BC" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill="url(#rev-fill)" />
      <polyline
        points={points}
        fill="none"
        stroke="#00C4BC"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DowHeatmap({ matrix }: { matrix: number[][] }) {
  const flat = matrix.flat();
  const max = Math.max(...flat, 1);
  const COLS = matrix[0]?.length ?? 12;
  const cellW = 16;
  const cellH = 16;
  const gap = 2;
  const W = COLS * (cellW + gap);
  const H = 7 * (cellH + gap);
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          fontSize: '0.62rem',
          color: '#A8B4C0',
          height: H,
        }}
      >
        {DOW_LABELS.map((l) => (
          <span key={l} style={{ lineHeight: `${cellH}px` }}>
            {l}
          </span>
        ))}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} aria-label="Order Heatmap">
        {matrix.map((row, dow) =>
          row.map((v, week) => {
            const intensity = v / max;
            const fill = v === 0 ? 'rgba(255,255,255,0.04)' : `rgba(0,196,188,${0.15 + intensity * 0.7})`;
            return (
              <rect
                key={`${dow}-${week}`}
                x={week * (cellW + gap)}
                y={dow * (cellH + gap)}
                width={cellW}
                height={cellH}
                rx={3}
                fill={fill}
              >
                <title>{`${DOW_LABELS[dow]} W-${COLS - 1 - week}: ${v} Orders`}</title>
              </rect>
            );
          }),
        )}
      </svg>
    </div>
  );
}

function TopCustomersBar({
  rows,
}: {
  rows: InsightsPayload['top_customers'];
}) {
  if (rows.length === 0) {
    return (
      <div style={{ padding: 12, color: '#A8B4C0', fontSize: '0.78rem' }}>
        No Customer Data Yet
      </div>
    );
  }
  const max = rows[0].lifetime_value || 1;
  return (
    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
      {rows.map((r) => {
        const pct = Math.max(2, (r.lifetime_value / max) * 100);
        return (
          <li key={r.id} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: '0.72rem',
                color: '#FFFFFF',
              }}
            >
              <span style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60%' }}>
                {r.name}
              </span>
              <span style={{ color: '#FACC15', fontWeight: 700 }}>{fmtUSD(r.lifetime_value)}</span>
            </div>
            <div
              style={{
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
                  background: 'linear-gradient(90deg, #FACC15 0%, #F59E0B 100%)',
                }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function ChartCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: 'rgba(15,25,35,0.7)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 12,
        padding: '12px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          fontSize: '0.78rem',
          fontWeight: 800,
          color: '#FFFFFF',
          textTransform: 'uppercase',
          letterSpacing: '0.03em',
        }}
      >
        {icon}
        {title}
      </div>
      {children}
    </div>
  );
}

export function ChartsView({
  revenueSpark,
  insights,
}: {
  revenueSpark: number[];
  insights: InsightsPayload | null;
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: 12,
      }}
    >
      <ChartCard
        title="Revenue Trend (12 Weeks)"
        icon={<TrendingUp size={14} color="#00C4BC" aria-hidden />}
      >
        <RevenueLine spark={revenueSpark} />
      </ChartCard>
      <ChartCard
        title="Order Heatmap (Day Of Week)"
        icon={<ShoppingBag size={14} color="#00C4BC" aria-hidden />}
      >
        {insights ? (
          <DowHeatmap matrix={insights.dow_heatmap} />
        ) : (
          <div style={{ color: '#A8B4C0', fontSize: '0.78rem' }}>Loading...</div>
        )}
      </ChartCard>
      <ChartCard
        title="Top Customers"
        icon={<Sparkles size={14} color="#FACC15" aria-hidden />}
      >
        {insights ? (
          <TopCustomersBar rows={insights.top_customers} />
        ) : (
          <div style={{ color: '#A8B4C0', fontSize: '0.78rem' }}>Loading...</div>
        )}
      </ChartCard>
      <ChartCard
        title="Cohort Retention"
        icon={<Users size={14} color="#60A5FA" aria-hidden />}
      >
        {!insights || insights.cohort_retention.length === 0 ? (
          <div style={{ color: '#A8B4C0', fontSize: '0.78rem' }}>
            No Cohort Data Yet
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', fontSize: '0.66rem', color: '#D0DAE4' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: 4, color: '#A8B4C0' }}>Signup</th>
                  <th style={{ padding: 4, color: '#A8B4C0' }}>N</th>
                  {Array.from({ length: insights.cohort_retention[0].retained_by_month.length }, (_, i) => (
                    <th key={i} style={{ padding: 4, color: '#A8B4C0' }}>M{i}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {insights.cohort_retention.map((c) => (
                  <tr key={c.cohort_month}>
                    <td style={{ padding: 4, fontWeight: 700, color: '#FFFFFF' }}>{c.cohort_month}</td>
                    <td style={{ padding: 4 }}>{c.size}</td>
                    {c.retained_by_month.map((r, i) => {
                      const pct = c.size > 0 ? r / c.size : 0;
                      const bg =
                        pct === 0
                          ? 'rgba(255,255,255,0.04)'
                          : `rgba(0,196,188,${0.15 + pct * 0.7})`;
                      return (
                        <td
                          key={i}
                          style={{
                            padding: 4,
                            background: bg,
                            color: pct > 0.3 ? '#FFFFFF' : '#D0DAE4',
                            textAlign: 'center',
                            minWidth: 28,
                          }}
                          title={`${r} of ${c.size}`}
                        >
                          {Math.round(pct * 100)}%
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </ChartCard>
    </div>
  );
}

/* ============================================================================
   Acquisition View - sources + funnel
   ========================================================================== */

export function AcquisitionView({
  sourceCounts,
  funnel,
}: {
  sourceCounts: { source: string; count: number }[];
  funnel: InsightsPayload['funnel'] | null;
}) {
  const total = sourceCounts.reduce((a, b) => a + b.count, 0) || 1;
  const sorted = [...sourceCounts].sort((a, b) => b.count - a.count);

  const stages = [
    { label: 'Storefront Visits', value: funnel?.visits ?? 0, color: '#60A5FA' },
    { label: 'Signups', value: funnel?.signups ?? 0, color: '#2DD4BF' },
    { label: 'First Orders', value: funnel?.first_orders ?? 0, color: '#00C4BC' },
    { label: 'Repeat Orders', value: funnel?.repeat_orders ?? 0, color: '#FACC15' },
  ];
  const max = Math.max(...stages.map((s) => s.value), 1);

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: 12,
      }}
    >
      <ChartCard
        title="Source Attribution"
        icon={<Users size={14} color="#00C4BC" aria-hidden />}
      >
        {sorted.length === 0 ? (
          <div style={{ color: '#A8B4C0', fontSize: '0.78rem' }}>
            No Source Data Yet
          </div>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {sorted.map((s) => {
              const pct = Math.round((s.count / total) * 100);
              return (
                <li key={s.source} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '0.72rem',
                      color: '#FFFFFF',
                    }}
                  >
                    <span style={{ fontWeight: 700 }}>{s.source || 'Direct'}</span>
                    <span style={{ color: '#A8B4C0' }}>
                      {s.count} ({pct}%)
                    </span>
                  </div>
                  <div
                    style={{
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
                        background:
                          'linear-gradient(90deg, #00C4BC 0%, #60A5FA 100%)',
                      }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </ChartCard>

      <ChartCard
        title="Conversion Funnel"
        icon={<AlertTriangle size={14} color="#F59E0B" aria-hidden />}
      >
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {stages.map((s, i) => {
            const pct = Math.max(4, (s.value / max) * 100);
            const dropoff =
              i > 0 && stages[i - 1].value > 0
                ? Math.round((s.value / stages[i - 1].value) * 100)
                : 100;
            return (
              <li key={s.label}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '0.72rem',
                    color: '#FFFFFF',
                    marginBottom: 3,
                  }}
                >
                  <span style={{ fontWeight: 700 }}>{s.label}</span>
                  <span style={{ color: '#A8B4C0' }}>
                    {s.value.toLocaleString()}{' '}
                    {i > 0 && (
                      <span style={{ color: dropoff >= 50 ? '#2DD4BF' : '#F59E0B' }}>
                        ({dropoff}%)
                      </span>
                    )}
                  </span>
                </div>
                <div
                  style={{
                    height: 10,
                    background: 'rgba(255,255,255,0.06)',
                    borderRadius: 6,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${pct}%`,
                      height: '100%',
                      background: s.color,
                      transition: 'width 250ms ease',
                    }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </ChartCard>
    </div>
  );
}

/* ============================================================================
   Insights fetcher hook - keeps the network call out of the parent
   ========================================================================== */

export function useInsights(enabled: boolean): InsightsPayload | null {
  const [data, setData] = useState<InsightsPayload | null>(null);
  useEffect(() => {
    if (!enabled || data) return;
    let alive = true;
    void (async () => {
      try {
        const r = await fetch('/api/agent/researchers/insights', { cache: 'no-store' });
        if (!r.ok) return;
        const j = (await r.json()) as InsightsPayload;
        if (alive) setData(j);
      } catch {
        /* network error - view shows loading placeholder */
      }
    })();
    return () => {
      alive = false;
    };
  }, [enabled, data]);
  return data;
}
