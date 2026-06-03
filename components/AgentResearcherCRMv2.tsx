'use client';

/**
 * AgentResearcherCRMv2 — Premium Rebuild
 *
 * Same API wiring (/api/agent/researchers/v2 + /api/agent/researchers/insights),
 * completely rebuilt UI to match the metal-frame premium aesthetic of the platform.
 *
 * Fixes: NaN display bugs, truncated KPI labels, dense cramped layout.
 * Upgrade: Metal-framed KPI cards, premium researcher rows, clean typography.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Pin, PinOff, MessageSquare, Tag as TagIcon, Search, Download,
  AlertTriangle, TrendingUp, TrendingDown, CircleAlert, Sparkles,
  Target, Flame, X, ChevronDown, ChevronUp, Mail, Activity as ActivityIcon,
  Table as TableIcon, LayoutGrid, BarChart3, GitBranch, Printer, Bell,
} from 'lucide-react';
import {
  KanbanView, ChartsView, AcquisitionView, useInsights,
  type KanbanResearcher,
} from './researcher-crm/views';

/* ── Types ─────────────────────────────────────────────────────────────── */

type Status = 'lead' | 'new' | 'first_order' | 'active' | 'vip' | 'at_risk' | 'churned';

interface Researcher {
  id: string; full_name: string | null; username: string | null;
  email: string | null; phone: string | null; joined_at: string;
  last_login: string | null; orders_count: number; lifetime_value: number;
  last_order_at: string | null; status: Status; churn_risk: number;
  sparkline: number[]; tags: { id: string; tag: string; color: string | null }[];
  is_pinned: boolean; last_contacted_at: string | null;
  acquisition_source: string | null; has_open_reminder: boolean;
}

interface Kpi { value: number; spark: number[]; delta_pct: number; label?: string; }

interface Insight {
  id: string; kind: 'at_risk' | 'repeat_rate' | 'commission' | 'no_growth' | 'goal';
  title: string; body: string;
  action?: { label: string; filter?: string; href?: string };
}

interface ActivityItem {
  id: string; kind: 'order' | 'signup' | 'login' | 'note' | 'message';
  researcher_id: string; researcher_name: string; at: string; meta?: string;
}

interface Payload {
  researchers: Researcher[];
  kpis: {
    researchers_count: Kpi; lifetime_value: Kpi; total_orders: Kpi;
    active_buyers: Kpi; avg_order_value: Kpi; repeat_rate: Kpi;
    new_this_month: Kpi; at_risk: Kpi; best_customer: Kpi & { label: string };
    lifetime_commission: Kpi;
  };
  insights: Insight[]; activity: ActivityItem[];
  goal: { target_count: number; achieved_count: number; progress_pct: number; streak_months: number; };
  kanban_counts: Record<Status, number>;
  source_counts: { source: string; count: number }[];
  storefront_slug: string | null;
}

type FilterKey = 'all' | 'vip' | 'at_risk' | 'new' | 'inactive' | 'pinned' | 'with_reminder';
type SortKey = 'name' | 'ltv' | 'orders' | 'last' | 'joined' | 'risk';
type TabKey = 'list' | 'kanban' | 'charts' | 'acquisition';

/* ── Status styles ──────────────────────────────────────────────────────── */

const STATUS_STYLES: Record<Status, { label: string; bg: string; fg: string; border: string }> = {
  lead:         { label: 'Lead',        bg: 'rgba(168,180,192,0.10)', fg: '#A8B4C0', border: 'rgba(168,180,192,0.40)' },
  new:          { label: 'New',         bg: 'rgba(96,165,250,0.12)',  fg: '#60A5FA', border: 'rgba(96,165,250,0.45)' },
  first_order:  { label: 'First Order', bg: 'rgba(45,212,191,0.12)',  fg: '#2DD4BF', border: 'rgba(45,212,191,0.45)' },
  active:       { label: 'Active',      bg: 'rgba(0,196,188,0.12)',   fg: '#00C4BC', border: 'rgba(0,196,188,0.45)' },
  vip:          { label: 'VIP',         bg: 'rgba(250,204,21,0.14)',  fg: '#FACC15', border: 'rgba(250,204,21,0.55)' },
  at_risk:      { label: 'At Risk',     bg: 'rgba(245,158,11,0.14)',  fg: '#F59E0B', border: 'rgba(245,158,11,0.50)' },
  churned:      { label: 'Churned',     bg: 'rgba(239,68,68,0.14)',   fg: '#EF4444', border: 'rgba(239,68,68,0.50)' },
};

/* ── Formatters ─────────────────────────────────────────────────────────── */

function safe(n: unknown): number {
  const v = Number(n);
  return Number.isFinite(v) ? v : 0;
}

function fmtUSD(n: unknown): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(safe(n));
}

function fmtInt(n: unknown): string {
  return new Intl.NumberFormat('en-US').format(safe(n));
}

function fmtPct(n: unknown): string {
  const v = safe(n);
  return `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;
}

function daysAgo(iso: string | null | undefined): string {
  if (!iso) return 'Never';
  const ms = Date.now() - new Date(iso).getTime();
  const d = Math.floor(ms / 86400000);
  if (d <= 0) return 'Today';
  if (d === 1) return 'Yesterday';
  if (d < 30) return `${d}d Ago`;
  const m = Math.floor(d / 30);
  if (m < 12) return `${m}mo Ago`;
  return `${Math.floor(d / 365)}y Ago`;
}

/* ── Micro-components ───────────────────────────────────────────────────── */

function Sparkline({ data, color = '#00C4BC' }: { data: number[]; color?: string }) {
  if (!data || data.length === 0) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const points = data.map((d, i) => {
    const x = (i / Math.max(data.length - 1, 1)) * 60;
    const y = 20 - ((d - min) / range) * 18 - 1;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  const area = `0,20 ${points} 60,20`;
  return (
    <svg viewBox="0 0 60 20" width="60" height="20" style={{ overflow: 'visible' }} aria-hidden>
      <polygon points={area} fill={color} opacity="0.12" />
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DeltaPill({ pct }: { pct: number }) {
  const v = safe(pct);
  const positive = v >= 0;
  const color = positive ? '#2DD4BF' : '#EF4444';
  const Icon = positive ? TrendingUp : TrendingDown;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 3,
      fontSize: '0.65rem', fontWeight: 700, color,
      background: `${color}1a`, border: `1px solid ${color}55`,
      borderRadius: 999, padding: '1px 6px',
    }}>
      <Icon size={10} aria-hidden />
      {fmtPct(v)}
    </span>
  );
}

function StatusBadge({ status }: { status: Status }) {
  const s = STATUS_STYLES[status] ?? STATUS_STYLES.lead;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', fontSize: '0.66rem',
      fontWeight: 800, letterSpacing: '0.03em', color: s.fg,
      background: s.bg, border: `1px solid ${s.border}`,
      borderRadius: 999, padding: '3px 10px', textTransform: 'uppercase', whiteSpace: 'nowrap',
    }}>
      {s.label}
    </span>
  );
}

function ChurnRiskBar({ risk }: { risk: number }) {
  const pct = Math.max(0, Math.min(100, Math.round(safe(risk))));
  const color = pct >= 70 ? '#EF4444' : pct >= 40 ? '#F59E0B' : '#2DD4BF';
  return (
    <div title={`Churn Risk ${pct}%`} style={{
      width: '100%', height: 5, background: 'rgba(255,255,255,0.08)',
      borderRadius: 999, overflow: 'hidden',
    }}>
      <div style={{ width: `${pct}%`, height: '100%', background: color, transition: 'width 250ms ease' }} />
    </div>
  );
}

/* ── KPI Card ───────────────────────────────────────────────────────────── */

function KpiCard({ label, value, spark, delta, color = '#00C4BC', onClick, subtitle }: {
  label: string; value: string; spark: number[]; delta: number;
  color?: string; onClick?: () => void; subtitle?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      style={{
        textAlign: 'left', padding: '16px', borderRadius: 16, cursor: onClick ? 'pointer' : 'default',
        background: 'linear-gradient(160deg, rgba(26,36,54,0.98) 0%, rgba(15,22,36,0.98) 100%)',
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 2px 12px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.05)',
        display: 'flex', flexDirection: 'column', gap: 10, minHeight: 108, minWidth: 0,
        transition: 'border-color 0.2s, box-shadow 0.2s',
      }}
      onMouseEnter={e => {
        if (onClick) {
          e.currentTarget.style.borderColor = `${color}55`;
          e.currentTarget.style.boxShadow = `0 4px 20px rgba(0,0,0,0.4), 0 0 0 1px ${color}22`;
        }
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
        e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.05)';
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <span style={{
          fontSize: '0.72rem', fontWeight: 700, color: '#8A9BB0',
          letterSpacing: '0.04em', textTransform: 'uppercase', lineHeight: 1.3,
        }}>
          {label}
        </span>
        <DeltaPill pct={delta} />
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8 }}>
        <div>
          <span style={{
            fontSize: '1.5rem', fontWeight: 800, color: '#FFFFFF', lineHeight: 1.05,
            letterSpacing: '-0.02em',
          }}>
            {value}
          </span>
          {subtitle && <div style={{ fontSize: '0.7rem', color, marginTop: 2, fontWeight: 600 }}>{subtitle}</div>}
        </div>
        <Sparkline data={spark} color={color} />
      </div>
    </button>
  );
}

/* ── Goal header ────────────────────────────────────────────────────────── */

function GoalHeader({ goal, onSetGoal }: { goal: Payload['goal']; onSetGoal: () => void }) {
  const pct = Math.max(0, Math.min(100, Math.round(safe(goal.progress_pct))));
  return (
    <div style={{
      padding: '16px 20px', borderRadius: 16,
      background: 'linear-gradient(135deg, rgba(0,196,188,0.08) 0%, rgba(0,196,188,0.02) 100%)',
      border: '1px solid rgba(0,196,188,0.25)',
      display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 14,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
        <div style={{
          width: 38, height: 38, borderRadius: 10, background: 'rgba(0,196,188,0.12)',
          border: '1px solid rgba(0,196,188,0.30)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <Target size={18} color="#00C4BC" aria-hidden />
        </div>
        <div>
          <div style={{ fontSize: '0.72rem', color: '#8A9BB0', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>This Month's Goal</div>
          <div style={{ fontSize: '1.1rem', color: '#FFFFFF', fontWeight: 800, marginTop: 2 }}>
            {fmtInt(goal.achieved_count)} <span style={{ color: '#8A9BB0', fontWeight: 400 }}>of</span> {fmtInt(goal.target_count || 0)} New Researchers
          </div>
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 180, maxWidth: 380 }}>
        <div style={{ position: 'relative', height: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 999, overflow: 'hidden' }}>
          <div style={{
            position: 'absolute', inset: 0, width: `${pct}%`,
            background: 'linear-gradient(90deg, #00C4BC 0%, #2DD4BF 100%)',
            transition: 'width 400ms ease', borderRadius: 999,
          }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: '0.7rem', color: '#8A9BB0' }}>
          <span>{pct}% Complete</span>
          {goal.streak_months > 0 && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: '#F59E0B', fontWeight: 700 }}>
              <Flame size={11} aria-hidden /> {goal.streak_months} Month Streak
            </span>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={onSetGoal}
        style={{
          padding: '8px 16px', borderRadius: 10, background: 'rgba(0,196,188,0.10)',
          border: '1px solid rgba(0,196,188,0.35)', color: '#00C4BC',
          fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
          transition: 'background 0.2s',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,196,188,0.20)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,196,188,0.10)'; }}
      >
        Set Goal
      </button>
    </div>
  );
}

/* ── Filter chip ────────────────────────────────────────────────────────── */

function FilterChip({ active, onClick, children, count }: {
  active: boolean; onClick: () => void; children: React.ReactNode; count?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '6px 14px', borderRadius: 999,
        background: active ? 'rgba(0,196,188,0.15)' : 'rgba(255,255,255,0.04)',
        border: `1px solid ${active ? 'rgba(0,196,188,0.50)' : 'rgba(255,255,255,0.10)'}`,
        color: active ? '#00C4BC' : '#C0B8A8',
        fontSize: '0.74rem', fontWeight: 700, cursor: 'pointer',
        display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
        transition: 'all 0.15s',
      }}
    >
      {children}
      {count !== undefined && (
        <span style={{
          background: active ? 'rgba(0,196,188,0.25)' : 'rgba(255,255,255,0.08)',
          padding: '0 7px', borderRadius: 999, fontSize: '0.66rem', fontWeight: 800,
        }}>
          {fmtInt(count)}
        </span>
      )}
    </button>
  );
}

/* ── Tab button ─────────────────────────────────────────────────────────── */

function TabButton({ active, onClick, icon, label }: {
  active: boolean; onClick: () => void; icon: React.ReactNode; label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '9px 16px', borderRadius: 10,
        background: active ? 'rgba(0,196,188,0.15)' : 'transparent',
        border: `1px solid ${active ? 'rgba(0,196,188,0.40)' : 'rgba(255,255,255,0.06)'}`,
        color: active ? '#00C4BC' : '#C0B8A8',
        fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
        transition: 'all 0.15s',
      }}
    >
      {icon}{label}
    </button>
  );
}

/* ── Researcher row card ─────────────────────────────────────────────────── */

function ResearcherRow({ r, expanded, onExpand, onMessage, onAddTag, onRemoveTag, onAddReminder, onTogglePin }: {
  r: Researcher; expanded: boolean;
  onExpand: () => void;
  onMessage: (r: Researcher) => void;
  onAddTag: (r: Researcher) => void;
  onRemoveTag: (r: Researcher, tag: string) => void;
  onAddReminder: (r: Researcher) => void;
  onTogglePin: (r: Researcher) => void;
}) {
  const s = STATUS_STYLES[r.status] ?? STATUS_STYLES.lead;
  return (
    <div style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
      <div
        onClick={onExpand}
        role="button"
        tabIndex={0}
        onKeyDown={e => e.key === 'Enter' && onExpand()}
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(200px,2fr) 100px 90px 130px 110px 130px',
          alignItems: 'center', gap: 8, padding: '14px 16px',
          cursor: 'pointer', borderLeft: `3px solid ${s.border}`,
          transition: 'background 0.15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.025)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
      >
        {/* Name + meta */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
          <span style={{
            fontWeight: 700, color: '#FFFFFF', fontSize: '0.9rem',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            display: 'inline-flex', alignItems: 'center', gap: 6,
          }}>
            {r.is_pinned && <Pin size={11} color="#FACC15" aria-hidden />}
            {r.has_open_reminder && <Bell size={11} color="#60A5FA" aria-hidden />}
            {r.full_name || r.username || r.email || 'Researcher'}
          </span>
          <span style={{ fontSize: '0.72rem', color: '#6A7A8A' }}>@{r.username || '—'}</span>
          {r.tags.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 2 }}>
              {r.tags.map(t => (
                <span key={t.id} style={{
                  fontSize: '0.62rem', padding: '1px 7px', borderRadius: 999,
                  background: 'rgba(0,196,188,0.10)', border: '1px solid rgba(0,196,188,0.30)',
                  color: '#00C4BC', fontWeight: 700,
                }}>{t.tag}</span>
              ))}
            </div>
          )}
        </div>

        {/* LTV */}
        <span style={{ fontWeight: 800, color: '#FFFFFF', fontSize: '0.88rem', textAlign: 'right' }}>
          {fmtUSD(r.lifetime_value)}
        </span>

        {/* Orders */}
        <span style={{ color: '#C0B8A8', fontSize: '0.82rem', textAlign: 'right' }}>
          {fmtInt(r.orders_count)}
        </span>

        {/* Last order */}
        <span style={{ color: '#8A9BB0', fontSize: '0.78rem' }}>
          {daysAgo(r.last_order_at)}
        </span>

        {/* Status */}
        <StatusBadge status={r.status} />

        {/* Actions */}
        <div
          style={{ display: 'flex', justifyContent: 'flex-end', gap: 4 }}
          onClick={e => e.stopPropagation()}
        >
          <button type="button" onClick={() => onMessage(r)} title="Message" className="crm-icon-btn"><MessageSquare size={13} /></button>
          <button type="button" onClick={() => onAddTag(r)} title="Add Tag" className="crm-icon-btn"><TagIcon size={13} /></button>
          <button type="button" onClick={() => onAddReminder(r)} title="Reminder" className="crm-icon-btn"><Bell size={13} /></button>
          <button type="button" onClick={() => onTogglePin(r)} title={r.is_pinned ? 'Unpin' : 'Pin'} className="crm-icon-btn">
            {r.is_pinned ? <PinOff size={13} /> : <Pin size={13} />}
          </button>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div style={{
          padding: '16px 20px 16px 20px', marginLeft: 3,
          background: 'rgba(0,196,188,0.03)', borderTop: '1px solid rgba(0,196,188,0.12)',
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px,1fr))', gap: 16,
        }}>
          {[
            { label: 'Joined', value: daysAgo(r.joined_at) },
            { label: 'Last Login', value: daysAgo(r.last_login) },
            { label: 'Last Contacted', value: daysAgo(r.last_contacted_at) },
            { label: 'Source', value: r.acquisition_source || 'Direct' },
          ].map(({ label, value }) => (
            <div key={label}>
              <div style={{ fontSize: '0.66rem', color: '#6A7A8A', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3 }}>{label}</div>
              <div style={{ fontSize: '0.85rem', color: '#FFFFFF', fontWeight: 600 }}>{value}</div>
            </div>
          ))}
          {r.email && (
            <div>
              <div style={{ fontSize: '0.66rem', color: '#6A7A8A', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3 }}>Email</div>
              <a href={`mailto:${r.email}`} style={{ fontSize: '0.85rem', color: '#00C4BC', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Mail size={12} aria-hidden /> {r.email}
              </a>
            </div>
          )}
          <div>
            <div style={{ fontSize: '0.66rem', color: '#6A7A8A', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3 }}>Churn Risk</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ChurnRiskBar risk={r.churn_risk} />
              <span style={{ fontSize: '0.78rem', color: '#C0B8A8', fontWeight: 700, flexShrink: 0 }}>{Math.round(safe(r.churn_risk))}%</span>
            </div>
          </div>
          {r.tags.length > 0 && (
            <div style={{ gridColumn: '1 / -1' }}>
              <div style={{ fontSize: '0.66rem', color: '#6A7A8A', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>Tags</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {r.tags.map(t => (
                  <span key={t.id} style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.72rem',
                    padding: '3px 10px', borderRadius: 999, background: 'rgba(0,196,188,0.10)',
                    border: '1px solid rgba(0,196,188,0.30)', color: '#00C4BC', fontWeight: 700,
                  }}>
                    {t.tag}
                    <button type="button" onClick={() => onRemoveTag(r, t.tag)} aria-label={`Remove ${t.tag}`}
                      style={{ background: 'transparent', border: 0, color: 'inherit', cursor: 'pointer', padding: 0, display: 'inline-flex' }}>
                      <X size={10} />
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
}

/* ── Activity feed ──────────────────────────────────────────────────────── */

function ActivityFeed({ items }: { items: ActivityItem[] }) {
  const [open, setOpen] = useState(false);
  if (items.length === 0) return null;
  const visible = open ? items : items.slice(0, 5);
  return (
    <div style={{
      marginTop: 8, borderRadius: 16,
      background: 'linear-gradient(160deg, rgba(20,28,44,0.95) 0%, rgba(13,19,30,0.95) 100%)',
      border: '1px solid rgba(255,255,255,0.07)',
      overflow: 'hidden',
    }}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          width: '100%', background: 'transparent', border: 0, color: '#FFFFFF',
          padding: '14px 18px', cursor: 'pointer', borderBottom: open ? '1px solid rgba(255,255,255,0.06)' : 'none',
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: '0.82rem' }}>
          <ActivityIcon size={14} color="#00C4BC" aria-hidden />
          Recent Activity
          <span style={{ fontSize: '0.68rem', color: '#6A7A8A', fontWeight: 400 }}>({items.length} events)</span>
        </span>
        {open ? <ChevronUp size={14} color="#6A7A8A" /> : <ChevronDown size={14} color="#6A7A8A" />}
      </button>
      {open && (
        <ul style={{ listStyle: 'none', padding: '0 18px', margin: 0, display: 'flex', flexDirection: 'column', gap: 0 }}>
          {visible.map((a, i) => (
            <li key={a.id} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
              padding: '10px 0', borderTop: i > 0 ? '1px solid rgba(255,255,255,0.04)' : 'none',
              fontSize: '0.78rem', color: '#C0B8A8',
            }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                <strong style={{ color: '#FFFFFF' }}>{a.researcher_name}</strong>
                {a.meta ? ` — ${a.meta}` : ''}
              </span>
              <span style={{ color: '#6A7A8A', fontSize: '0.72rem', whiteSpace: 'nowrap' }}>{daysAgo(a.at)}</span>
            </li>
          ))}
          {!open && items.length > 5 && (
            <li style={{ padding: '10px 0', textAlign: 'center' }}>
              <button type="button" onClick={() => setOpen(true)} style={{ background: 'none', border: 'none', color: '#00C4BC', fontSize: '0.74rem', cursor: 'pointer' }}>
                View All {items.length} Events
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

/* ── Empty state ────────────────────────────────────────────────────────── */

function EmptyState({ slug }: { slug: string | null }) {
  const storefrontUrl = typeof window !== 'undefined' && slug
    ? `${window.location.origin}/${slug}` : slug ? `/${slug}` : null;
  const onCopy = useCallback(() => {
    if (!storefrontUrl) return;
    void navigator.clipboard.writeText(storefrontUrl);
    toast.success('Storefront Link Copied');
  }, [storefrontUrl]);

  return (
    <div style={{
      padding: '48px 24px', borderRadius: 16,
      background: 'linear-gradient(160deg, rgba(18,26,42,0.95) 0%, rgba(12,18,30,0.95) 100%)',
      border: '1px dashed rgba(0,196,188,0.25)', textAlign: 'center',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
    }}>
      <div style={{ width: 56, height: 56, borderRadius: 16, background: 'rgba(0,196,188,0.10)', border: '1px solid rgba(0,196,188,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Sparkles size={24} color="#00C4BC" />
      </div>
      <div>
        <div style={{ fontSize: '1.15rem', color: '#FFFFFF', fontWeight: 800, marginBottom: 8 }}>No Researchers Yet</div>
        <p style={{ color: '#8A9BB0', fontSize: '0.84rem', maxWidth: 440, lineHeight: 1.55, margin: 0 }}>
          Your CRM activates the moment your first researcher joins. Share your storefront, onboard a researcher, and track your growth here.
        </p>
      </div>
      <ol style={{ textAlign: 'left', fontSize: '0.8rem', color: '#C0B8A8', lineHeight: 1.6, paddingLeft: 18, margin: 0, maxWidth: 360 }}>
        <li>Share your storefront link or QR code</li>
        <li>Onboard a researcher from the button above</li>
        <li>Pin your VIPs and tag your repeat buyers</li>
      </ol>
      {storefrontUrl && (
        <button type="button" onClick={onCopy} style={{
          padding: '11px 24px', borderRadius: 10, background: 'rgba(0,196,188,0.12)',
          border: '1px solid rgba(0,196,188,0.40)', color: '#00C4BC',
          fontSize: '0.84rem', fontWeight: 700, cursor: 'pointer',
        }}>
          Copy Storefront Link
        </button>
      )}
    </div>
  );
}

/* ── Main component ─────────────────────────────────────────────────────── */

export default function AgentResearcherCRMv2() {
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('ltv');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>('list');

  const insights = useInsights(tab === 'charts' || tab === 'acquisition');

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const r = await fetch('/api/agent/researchers/v2', { cache: 'no-store' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setData((await r.json()) as Payload);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could Not Load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const onTogglePin = useCallback(async (r: Researcher) => {
    const res = await fetch('/api/agent/researchers/pins', {
      method: r.is_pinned ? 'DELETE' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ researcherId: r.id }),
    });
    if (!res.ok) { toast.error('Could Not Update Pin'); return; }
    toast.success(r.is_pinned ? 'Pin Removed' : 'Researcher Pinned');
    void refresh();
  }, [refresh]);

  const onAddTag = useCallback(async (r: Researcher) => {
    const tag = window.prompt('Tag For This Researcher (e.g. VIP, Discount Eligible)');
    if (!tag) return;
    const trimmed = tag.trim().slice(0, 32);
    if (!trimmed) return;
    const res = await fetch('/api/agent/researchers/tags', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ researcherId: r.id, tag: trimmed }),
    });
    if (!res.ok) { toast.error('Could Not Save Tag'); return; }
    toast.success('Tag Added');
    void refresh();
  }, [refresh]);

  const onRemoveTag = useCallback(async (r: Researcher, tag: string) => {
    const res = await fetch('/api/agent/researchers/tags', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ researcherId: r.id, tag }),
    });
    if (!res.ok) { toast.error('Could Not Remove Tag'); return; }
    void refresh();
  }, [refresh]);

  const onMessage = useCallback((r: Researcher | { id: string }) => {
    window.location.href = `/messenger?participant=${encodeURIComponent(r.id)}`;
  }, []);

  const onAddReminder = useCallback(async (r: Researcher) => {
    const title = window.prompt('What Do You Want To Be Reminded About?');
    if (!title) return;
    const daysRaw = window.prompt('In How Many Days?', '7');
    const days = Math.max(1, parseInt(daysRaw ?? '7', 10) || 7);
    const remindAt = new Date(Date.now() + days * 86400000).toISOString();
    const res = await fetch('/api/agent/researchers/reminders', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ researcherId: r.id, title: title.slice(0, 200), remindAt }),
    });
    if (!res.ok) { toast.error('Could Not Save Reminder'); return; }
    toast.success(`Reminder Set For ${days} Days From Now`);
    void refresh();
  }, [refresh]);

  const onSetGoal = useCallback(async () => {
    const raw = window.prompt('New Researchers Target For This Month');
    if (!raw) return;
    const n = parseInt(raw, 10);
    if (!Number.isFinite(n) || n < 0) { toast.error('Enter A Whole Number'); return; }
    const res = await fetch('/api/agent/researchers/goals', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetCount: n }),
    });
    if (!res.ok) { toast.error('Could Not Save Goal'); return; }
    toast.success('Goal Saved');
    void refresh();
  }, [refresh]);

  const onExportCsv = useCallback(() => { window.location.href = '/api/agent/researchers/export'; }, []);
  const onPrintSnapshot = useCallback(() => { window.print(); }, []);

  const filtered = useMemo(() => {
    if (!data) return [];
    const term = search.trim().toLowerCase();
    const byFilter = data.researchers.filter(r => {
      switch (filter) {
        case 'vip': return r.status === 'vip';
        case 'at_risk': return r.status === 'at_risk' || r.status === 'churned';
        case 'new': return r.status === 'new' || r.status === 'first_order';
        case 'inactive': return r.orders_count === 0;
        case 'pinned': return r.is_pinned;
        case 'with_reminder': return r.has_open_reminder;
        default: return true;
      }
    });
    const bySearch = term
      ? byFilter.filter(r =>
          (r.full_name ?? '').toLowerCase().includes(term) ||
          (r.username ?? '').toLowerCase().includes(term) ||
          (r.email ?? '').toLowerCase().includes(term))
      : byFilter;
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...bySearch].sort((a, b) => {
      switch (sortBy) {
        case 'name': return (a.full_name ?? '').localeCompare(b.full_name ?? '') * dir;
        case 'orders': return (a.orders_count - b.orders_count) * dir;
        case 'last': return (new Date(a.last_order_at ?? 0).getTime() - new Date(b.last_order_at ?? 0).getTime()) * dir;
        case 'joined': return (new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime()) * dir;
        case 'risk': return (a.churn_risk - b.churn_risk) * dir;
        default: return (a.lifetime_value - b.lifetime_value) * dir;
      }
    });
  }, [data, filter, search, sortBy, sortDir]);

  const kanbanRows: KanbanResearcher[] = useMemo(() => {
    if (!data) return [];
    return data.researchers.map(r => ({
      id: r.id, full_name: r.full_name, username: r.username,
      lifetime_value: r.lifetime_value, orders_count: r.orders_count,
      last_order_at: r.last_order_at, status: r.status, churn_risk: r.churn_risk,
    }));
  }, [data]);

  const sortBtn = (key: SortKey, label: string) => (
    <button
      type="button"
      onClick={() => { setSortBy(key); setSortDir(d => sortBy === key && d === 'desc' ? 'asc' : 'desc'); }}
      style={{
        background: 'transparent', border: 0, color: sortBy === key ? '#00C4BC' : '#8A9BB0',
        fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em',
        cursor: 'pointer', font: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 3,
        textAlign: 'right',
      }}
    >
      {label}{sortBy === key ? (sortDir === 'desc' ? ' ↓' : ' ↑') : ''}
    </button>
  );

  if (loading && !data) {
    return (
      <div style={{ padding: '32px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, color: '#8A9BB0' }}>
        <div style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid #00C4BC', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
        Loading Researcher CRM...
      </div>
    );
  }
  if (error) {
    return (
      <div style={{ padding: '24px', color: '#EF4444', display: 'flex', alignItems: 'center', gap: 12 }}>
        <AlertTriangle size={16} /> Could Not Load: {error}
        <button type="button" onClick={() => void refresh()} style={{ marginLeft: 8, padding: '6px 14px', borderRadius: 8, background: 'rgba(0,196,188,0.10)', border: '1px solid rgba(0,196,188,0.40)', color: '#00C4BC', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700 }}>
          Retry
        </button>
      </div>
    );
  }
  if (!data) return null;

  const k = data.kpis;
  const hasAny = data.researchers.length > 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }} className="crm-shell">

      {/* Goal */}
      <GoalHeader goal={data.goal} onSetGoal={onSetGoal} />

      {/* KPI grid — 5-col on desktop, wraps on mobile */}
      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))' }}>
        <KpiCard label="Total Researchers" value={fmtInt(k.researchers_count.value)} spark={k.researchers_count.spark} delta={k.researchers_count.delta_pct} onClick={() => { setTab('list'); setFilter('all'); }} />
        <KpiCard label="Lifetime Revenue" value={fmtUSD(k.lifetime_value.value)} spark={k.lifetime_value.spark} delta={k.lifetime_value.delta_pct} color="#FACC15" />
        <KpiCard label="Total Orders" value={fmtInt(k.total_orders.value)} spark={k.total_orders.spark} delta={k.total_orders.delta_pct} color="#60A5FA" />
        <KpiCard label="Active Buyers" value={fmtInt(k.active_buyers.value)} spark={k.active_buyers.spark} delta={k.active_buyers.delta_pct} onClick={() => { setTab('list'); setFilter('all'); }} />
        <KpiCard label="Avg Order Value" value={fmtUSD(k.avg_order_value.value)} spark={k.avg_order_value.spark} delta={k.avg_order_value.delta_pct} color="#2DD4BF" />
        <KpiCard label="Repeat Rate" value={`${Math.round(safe(k.repeat_rate.value))}%`} spark={k.repeat_rate.spark} delta={k.repeat_rate.delta_pct} color="#A78BFA" />
        <KpiCard label="New This Month" value={fmtInt(k.new_this_month.value)} spark={k.new_this_month.spark} delta={k.new_this_month.delta_pct} onClick={() => { setTab('list'); setFilter('new'); }} />
        <KpiCard label="At Risk" value={fmtInt(k.at_risk.value)} spark={k.at_risk.spark} delta={k.at_risk.delta_pct} color="#F59E0B" onClick={() => { setTab('list'); setFilter('at_risk'); }} />
        <KpiCard label="Best Customer" value={k.best_customer.label || '—'} spark={k.best_customer.spark} delta={k.best_customer.delta_pct} color="#FACC15" subtitle={k.best_customer.value > 0 ? fmtUSD(k.best_customer.value) : undefined} />
        <KpiCard label="Commission Earned" value={fmtUSD(k.lifetime_commission.value)} spark={k.lifetime_commission.spark} delta={k.lifetime_commission.delta_pct} color="#2DD4BF" />
      </div>

      {/* Tab bar */}
      <div role="tablist" aria-label="Researcher CRM View" style={{
        display: 'flex', gap: 6, padding: '5px',
        background: 'rgba(12,18,30,0.8)', border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 14, overflowX: 'auto',
      }}>
        <TabButton active={tab === 'list'} onClick={() => setTab('list')} icon={<TableIcon size={14} aria-hidden />} label="Researchers" />
        <TabButton active={tab === 'kanban'} onClick={() => setTab('kanban')} icon={<LayoutGrid size={14} aria-hidden />} label="Kanban" />
        <TabButton active={tab === 'charts'} onClick={() => setTab('charts')} icon={<BarChart3 size={14} aria-hidden />} label="Charts" />
        <TabButton active={tab === 'acquisition'} onClick={() => setTab('acquisition')} icon={<GitBranch size={14} aria-hidden />} label="Acquisition" />
      </div>

      {/* List tab */}
      {tab === 'list' && (
        <>
          {/* Filters + search + export */}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
            <FilterChip active={filter === 'all'} onClick={() => setFilter('all')} count={data.researchers.length}>All</FilterChip>
            <FilterChip active={filter === 'vip'} onClick={() => setFilter('vip')} count={data.kanban_counts.vip}>VIPs</FilterChip>
            <FilterChip active={filter === 'at_risk'} onClick={() => setFilter('at_risk')} count={(data.kanban_counts.at_risk ?? 0) + (data.kanban_counts.churned ?? 0)}>At Risk</FilterChip>
            <FilterChip active={filter === 'new'} onClick={() => setFilter('new')} count={(data.kanban_counts.new ?? 0) + (data.kanban_counts.first_order ?? 0)}>New</FilterChip>
            <FilterChip active={filter === 'inactive'} onClick={() => setFilter('inactive')} count={data.kanban_counts.lead}>Inactive</FilterChip>
            <FilterChip active={filter === 'pinned'} onClick={() => setFilter('pinned')} count={data.researchers.filter(r => r.is_pinned).length}>Pinned</FilterChip>
            <div style={{ flex: 1 }} />
            {/* Search */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)',
              borderRadius: 10, padding: '0 12px', minWidth: 220,
            }}>
              <Search size={14} color="#8A9BB0" aria-hidden />
              <input
                type="search" value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search Name, Email, Username"
                style={{ border: 0, background: 'transparent', color: '#FFFFFF', padding: '9px 0', fontSize: '0.78rem', outline: 'none', minWidth: 0, width: '100%' }}
              />
            </div>
            <button type="button" onClick={onExportCsv} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)', color: '#C0B8A8', fontSize: '0.74rem', fontWeight: 700, cursor: 'pointer' }}>
              <Download size={13} /> CSV
            </button>
            <button type="button" onClick={onPrintSnapshot} title="Print / Save PDF" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)', color: '#C0B8A8', fontSize: '0.74rem', fontWeight: 700, cursor: 'pointer' }}>
              <Printer size={13} /> PDF
            </button>
          </div>

          {/* Table */}
          {!hasAny ? (
            <EmptyState slug={data.storefront_slug} />
          ) : (
            <div style={{
              borderRadius: 16, overflow: 'hidden',
              background: 'linear-gradient(160deg, rgba(18,26,42,0.98) 0%, rgba(12,18,30,0.98) 100%)',
              border: '1px solid rgba(255,255,255,0.08)',
              boxShadow: '0 4px 24px rgba(0,0,0,0.30)',
            }}>
              {/* Header */}
              <div role="row" style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(200px,2fr) 100px 90px 130px 110px 130px',
                alignItems: 'center', gap: 8, padding: '10px 16px',
                background: 'rgba(255,255,255,0.025)',
                borderBottom: '1px solid rgba(255,255,255,0.07)',
              }} className="crm-row-head">
                <span style={{ fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#8A9BB0' }}>Researcher</span>
                <span style={{ textAlign: 'right' }}>{sortBtn('ltv', 'LTV')}</span>
                <span style={{ textAlign: 'right' }}>{sortBtn('orders', 'Orders')}</span>
                <span>{sortBtn('last', 'Last Order')}</span>
                <span style={{ fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#8A9BB0' }}>Status</span>
                <span style={{ textAlign: 'right', fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#8A9BB0' }}>Actions</span>
              </div>

              {filtered.length === 0 ? (
                <div style={{ padding: '32px', textAlign: 'center', color: '#6A7A8A', fontSize: '0.84rem' }}>
                  No researchers match your filter.
                </div>
              ) : (
                filtered.map(r => (
                  <ResearcherRow
                    key={r.id}
                    r={r}
                    expanded={expandedId === r.id}
                    onExpand={() => setExpandedId(id => id === r.id ? null : r.id)}
                    onMessage={onMessage}
                    onAddTag={onAddTag}
                    onRemoveTag={onRemoveTag}
                    onAddReminder={onAddReminder}
                    onTogglePin={onTogglePin}
                  />
                ))
              )}
            </div>
          )}
        </>
      )}

      {tab === 'kanban' && (
        <div style={{ marginTop: 4 }}>
          <KanbanView researchers={kanbanRows} onCardClick={id => { setTab('list'); setExpandedId(id); }} />
        </div>
      )}
      {tab === 'charts' && (
        <div style={{ marginTop: 4 }}>
          <ChartsView revenueSpark={k.lifetime_value.spark} insights={insights} />
        </div>
      )}
      {tab === 'acquisition' && (
        <div style={{ marginTop: 4 }}>
          <AcquisitionView sourceCounts={data.source_counts} funnel={insights?.funnel ?? null} />
        </div>
      )}

      <ActivityFeed items={data.activity} />

      <style jsx>{`
        .crm-icon-btn {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.10);
          color: #8a9bb0;
          border-radius: 8px;
          padding: 6px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 30px;
          min-height: 30px;
          transition: all 0.15s;
        }
        .crm-icon-btn:hover {
          background: rgba(0,196,188,0.12);
          color: #00c4bc;
          border-color: rgba(0,196,188,0.40);
        }
        @media print {
          .crm-shell button, .crm-shell input, .crm-shell [role='tablist'] { display: none !important; }
        }
        @media (max-width: 640px) {
          .crm-row-head { display: none !important; }
        }
      `}</style>
    </div>
  );
}
