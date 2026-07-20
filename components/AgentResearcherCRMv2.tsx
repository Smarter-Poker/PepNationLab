'use client';

/**
 * AgentResearcherCRMv2 - Full Premium Build
 *
 * Changes in this version:
 *  - Props: onResetPassword, onPromote, onToggleAutoApprove, isSuperAgent
 *  - Inline goal input (no window.prompt)
 *  - Inline tag input chip (no window.prompt)
 *  - Auto-approve toggle in expanded row (regression fix)
 *  - Reset Password + Promote To Agent in expanded row
 *  - Onboarding score badge per researcher
 *  - Last Login column visible in table
 *  - Sort by Last Login option
 *  - Inline note field (saves to /api/agent/researchers/notes)
 *  - Clickable KPI tile affordance (arrow indicator)
 *  - "Message All Never Logged In" bulk nudge
 *  - Full mobile-first layout
 */

import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Pin, PinOff, MessageSquare, Tag as TagIcon, Search, Download,
  AlertTriangle, TrendingUp, TrendingDown, CircleAlert, Sparkles,
  Target, Flame, X, ChevronDown, ChevronUp, Mail, Activity as ActivityIcon,
  Table as TableIcon, LayoutGrid, BarChart3, GitBranch, Printer, Bell,
  CheckCircle2, UserCheck, ArrowUpRight, StickyNote, Shield, RefreshCw,
  UserPlus, Share2, ShoppingBag, Rocket, Link as LinkIcon, Copy, XCircle,
} from 'lucide-react';
import {
  KanbanView, ChartsView, AcquisitionView, useInsights,
  type KanbanResearcher,
} from './researcher-crm/views';

/* -----------------------------------------------------------------------
   Types
----------------------------------------------------------------------- */

type Status = 'lead' | 'new' | 'first_order' | 'active' | 'vip' | 'at_risk' | 'churned';

interface Researcher {
  id: string; full_name: string | null; username: string | null;
  email: string | null; phone: string | null;
  joined_at: string; // mapped from created_at in payload
  last_login: string | null; last_sign_in_at?: string | null;
  orders_count: number; lifetime_value: number;
  last_order_at: string | null; status: Status; churn_risk: number;
  sparkline: number[];
  tags: { id: string; tag: string; color: string | null }[];
  is_pinned: boolean; last_contacted_at: string | null;
  acquisition_source: string | null; has_open_reminder: boolean;
  note?: string; note_updated_at?: string | null;
  reminders?: { id: string; title: string; remind_at: string }[];
  account_type?: string | null;
  auto_approve_orders?: boolean;
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
  goal: { target_count: number | null; achieved_count: number; progress_pct: number | null; streak_months: number; };
  kanban_counts: Record<Status, number>;
  source_counts: { source: string; count: number }[];
  storefront_slug: string | null;
}

type FilterKey = 'all' | 'vip' | 'at_risk' | 'new' | 'inactive' | 'pinned' | 'with_reminder';
type SortKey = 'name' | 'ltv' | 'orders' | 'last' | 'joined' | 'risk' | 'login';
type TabKey = 'list' | 'kanban' | 'charts' | 'acquisition';

export interface CRMExternalProps {
  isSuperAgent?: boolean;
  isSubAgent?: boolean;
  onResetPassword?: (r: { id: string; name: string; username: string }) => void;
  onPromote?: (r: { id: string; full_name: string | null; username: string | null; email: string | null; created_at: string; auto_approve_orders?: boolean; }) => void;
  onToggleAutoApprove?: (researcherId: string, currentStatus: boolean) => void;
}

/* -----------------------------------------------------------------------
   Status config
----------------------------------------------------------------------- */

const STATUS_STYLES: Record<Status, { label: string; bg: string; fg: string; border: string }> = {
  lead:        { label: 'Lead',        bg: 'rgba(168,180,192,0.10)', fg: '#A8B4C0', border: 'rgba(168,180,192,0.40)' },
  new:         { label: 'New',         bg: 'rgba(94,234,212,0.12)',  fg: '#5EEAD4', border: 'rgba(94,234,212,0.42)' },
  first_order: { label: 'First Order', bg: 'rgba(45,212,191,0.12)',  fg: '#2DD4BF', border: 'rgba(45,212,191,0.45)' },
  active:      { label: 'Active',      bg: 'rgba(0,196,188,0.12)',   fg: '#00C4BC', border: 'rgba(0,196,188,0.45)' },
  vip:         { label: 'VIP',         bg: 'rgba(208,218,228,0.14)', fg: '#D0DAE4', border: 'rgba(208,218,228,0.55)' },
  at_risk:     { label: 'At Risk',     bg: 'rgba(248,113,113,0.14)', fg: '#F87171', border: 'rgba(248,113,113,0.50)' },
  churned:     { label: 'Churned',     bg: 'rgba(239,68,68,0.14)',   fg: '#EF4444', border: 'rgba(239,68,68,0.50)' },
};

/* -----------------------------------------------------------------------
   Formatters
----------------------------------------------------------------------- */

function safe(n: unknown): number {
  const v = Number(n);
  return Number.isFinite(v) ? v : 0;
}
function fmtUSD(n: unknown) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(safe(n));
}
function fmtInt(n: unknown) { return new Intl.NumberFormat('en-US').format(safe(n)); }
function fmtPct(n: unknown) { const v = safe(n); return `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`; }
function daysAgo(iso: string | null | undefined): string {
  if (!iso) return 'Never';
  const ms = Date.now() - new Date(iso).getTime();
  const d = Math.floor(ms / 86400000);
  if (d <= 0) return 'Today';
  if (d === 1) return 'Yesterday';
  if (d < 7)  return `${d}d Ago`;
  if (d < 30) return `${Math.floor(d / 7)}w Ago`;
  const m = Math.floor(d / 30);
  if (m < 12) return `${m}mo Ago`;
  return `${Math.floor(d / 365)}y Ago`;
}

/* -----------------------------------------------------------------------
   Onboarding score
----------------------------------------------------------------------- */

function onboardScore(r: Researcher): { score: number; label: string; color: string } {
  let score = 0;
  if (r.full_name) score += 25;
  if (r.username) score += 25;
  const hasLogin = !!(r.last_login ?? r.last_sign_in_at);
  if (hasLogin) score += 25;
  if (r.orders_count > 0) score += 25;
  const color = score === 100 ? '#00C4BC' : score >= 50 ? '#2DD4BF' : '#EF4444';
  const label = score === 100 ? 'Complete' : score >= 75 ? 'Almost' : score >= 50 ? 'Partial' : 'New';
  return { score, label, color };
}

/* -----------------------------------------------------------------------
   Premium UI Micro-components
----------------------------------------------------------------------- */

function Tooltip({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <div className="tooltip-container">
      {children}
      <span className="tooltip-text">{text}</span>
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* KPI Skeletons */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton-box hover-lift glass-panel" style={{ height: 104, borderRadius: 14 }} />
        ))}
      </div>
      {/* Table Row Skeletons */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="skeleton-box glass-panel" style={{ height: 60, borderRadius: 12 }} />
        ))}
      </div>
    </div>
  );
}

function RadialProgress({ pct, size = 56, strokeWidth = 5 }: { pct: number; size?: number; strokeWidth?: number }) {
  const radius = (size - strokeWidth) / 2;
  const circum = radius * 2 * Math.PI;
  const offset = circum - (pct / 100) * circum;
  return (
    <div style={{ position: 'relative', width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', overflow: 'visible' }}>
        <circle cx={size/2} cy={size/2} r={radius} stroke="rgba(255,255,255,0.08)" strokeWidth={strokeWidth} fill="none" />
        <circle cx={size/2} cy={size/2} r={radius} stroke="url(#cyan-grad)" strokeWidth={strokeWidth} fill="none" strokeDasharray={circum} strokeDashoffset={offset} strokeLinecap="round" style={{ transition: 'stroke-dashoffset 1.5s cubic-bezier(0.4, 0, 0.2, 1)' }} />
        <defs>
          <linearGradient id="cyan-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#00C4BC" />
            <stop offset="100%" stopColor="#2DD4BF" />
          </linearGradient>
        </defs>
      </svg>
      <span style={{ position: 'absolute', fontSize: '0.75rem', fontWeight: 800, color: '#FFFFFF', letterSpacing: '-0.02em' }}>{pct}%</span>
    </div>
  );
}

function Sparkline({ data, color = '#00C4BC' }: { data: number[]; color?: string }) {
  if (!data || data.length === 0) return <span style={{ display: 'inline-block', width: 60, height: 20 }} />;
  const max = Math.max(...data, 1), min = Math.min(...data, 0), range = max - min || 1;
  const pts = data.map((d, i) => `${((i / Math.max(data.length - 1, 1)) * 60).toFixed(1)},${(20 - ((d - min) / range) * 18 - 1).toFixed(1)}`).join(' ');
  return (
    <svg viewBox="0 0 60 20" width="60" height="20" style={{ overflow: 'visible', flexShrink: 0 }} aria-hidden>
      <polygon points={`0,20 ${pts} 60,20`} fill={color} opacity="0.12" />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="sparkline-path" />
    </svg>
  );
}

function DeltaPill({ pct }: { pct: number }) {
  const v = safe(pct); const pos = v >= 0; const color = pos ? '#2DD4BF' : '#EF4444';
  const Icon = pos ? TrendingUp : TrendingDown;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: '0.63rem', fontWeight: 700, color, background: `${color}1a`, border: `1px solid ${color}44`, borderRadius: 999, padding: '1px 5px', flexShrink: 0 }}>
      <Icon size={9} aria-hidden />{fmtPct(v)}
    </span>
  );
}

function StatusBadge({ status }: { status: Status }) {
  const s = STATUS_STYLES[status] ?? STATUS_STYLES.lead;
  return <span className={status === 'vip' ? 'vip-badge-glow' : undefined} style={{ display: 'inline-flex', alignItems: 'center', fontSize: '0.64rem', fontWeight: 800, letterSpacing: '0.03em', color: s.fg, background: s.bg, border: `1px solid ${s.border}`, borderRadius: 999, padding: '3px 9px', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{s.label}</span>;
}

function ChurnBar({ risk }: { risk: number }) {
  const pct = Math.max(0, Math.min(100, Math.round(safe(risk))));
  const color = pct >= 70 ? '#EF4444' : pct >= 40 ? '#A8B4C0' : '#2DD4BF';
  return (
    <Tooltip text={`Churn Risk ${pct}%`}>
      <div style={{ width: '100%', height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 999, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, transition: 'width 250ms ease' }} />
      </div>
    </Tooltip>
  );
}

function ToggleSwitch({ checked, onChange, disabled, id }: { checked: boolean; onChange: () => void; disabled?: boolean; id: string }) {
  return (
    <label htmlFor={id} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', cursor: disabled ? 'not-allowed' : 'pointer', gap: 8 }}>
      <input id={id} type="checkbox" checked={checked} onChange={onChange} disabled={disabled} style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }} />
      <span style={{ position: 'relative', display: 'inline-block', width: 38, height: 22, background: checked ? '#00C4BC' : 'rgba(255,255,255,0.12)', borderRadius: 11, transition: 'background 0.25s', opacity: disabled ? 0.5 : 1 }}>
        <span style={{ position: 'absolute', top: 3, left: checked ? 19 : 3, width: 16, height: 16, background: '#fff', borderRadius: '50%', transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.3)' }} />
      </span>
    </label>
  );
}

/* -----------------------------------------------------------------------
   KPI Card
----------------------------------------------------------------------- */

function KpiCard({ label, value, spark, delta, color = '#00C4BC', onClick, subtitle, muted }: {
  label: string; value: string; spark: number[]; delta: number;
  color?: string; onClick?: () => void; subtitle?: string; muted?: boolean;
}) {
  const clickable = !!onClick;
  return (
    <button type="button" onClick={onClick} disabled={!clickable}
      className="hover-lift"
      style={{ textAlign: 'left', padding: '14px 16px', borderRadius: 14, cursor: clickable ? 'pointer' : 'default', background: 'linear-gradient(160deg, rgba(24,34,52,0.98) 0%, rgba(14,20,34,0.98) 100%)', border: `1px solid ${clickable ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.06)'}`, boxShadow: '0 2px 12px rgba(0,0,0,0.35)', display: 'flex', flexDirection: 'column', gap: 10, minHeight: 104, minWidth: 0, opacity: muted ? 0.55 : 1, transition: 'border-color 0.2s, box-shadow 0.2s, transform 0.15s, opacity 0.2s' }}
      onMouseEnter={e => { if (clickable) { e.currentTarget.style.borderColor = `${color}66`; e.currentTarget.style.boxShadow = `0 6px 24px rgba(0,0,0,0.4), 0 0 0 1px ${color}22`; e.currentTarget.style.transform = 'translateY(-1px)'; } }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = clickable ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.06)'; e.currentTarget.style.boxShadow = '0 2px 12px rgba(0,0,0,0.35)'; e.currentTarget.style.transform = 'translateY(0)'; }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6 }}>
        <span style={{ fontSize: '0.7rem', fontWeight: 700, color: '#7A8B9E', letterSpacing: '0.04em', textTransform: 'uppercase', lineHeight: 1.35 }}>{label}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          <DeltaPill pct={delta} />
          {clickable && <ArrowUpRight size={11} color={color} aria-hidden style={{ flexShrink: 0 }} />}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          <span style={{ fontSize: '1.45rem', fontWeight: 800, color: '#FFFFFF', letterSpacing: '-0.02em', lineHeight: 1.05, display: 'block' }}>{value}</span>
          {subtitle && <span style={{ fontSize: '0.68rem', color, marginTop: 2, display: 'block', fontWeight: 600 }}>{subtitle}</span>}
        </div>
        <Sparkline data={spark} color={color} />
      </div>
    </button>
  );
}

/* -----------------------------------------------------------------------
   Goal header (inline input, no prompt)
----------------------------------------------------------------------- */

function GoalHeader({ goal, onSetGoal }: {
  goal: Payload['goal'];
  onSetGoal: (target: number) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(String(goal.target_count ?? ''));
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const pct = Math.max(0, Math.min(100, Math.round(safe(goal.progress_pct))));

  const handleSave = async () => {
    const n = parseInt(val, 10);
    if (!Number.isFinite(n) || n < 0) { toast.error('Enter a whole number'); return; }
    setSaving(true);
    await onSetGoal(n);
    setSaving(false);
    setEditing(false);
  };

  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  return (
    <div style={{ padding: '16px 20px', borderRadius: 16, background: 'linear-gradient(135deg, rgba(0,196,188,0.07) 0%, rgba(0,196,188,0.02) 100%)', border: '1px solid rgba(0,196,188,0.22)', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: '1 1 200px', minWidth: 0 }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(0,196,188,0.12)', border: '1px solid rgba(0,196,188,0.28)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Target size={17} color="#00C4BC" aria-hidden />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '0.69rem', color: '#7A8B9E', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>This Month&apos;s Goal</div>
          <div style={{ fontSize: '1.05rem', color: '#FFFFFF', fontWeight: 800, marginTop: 2 }}>
            {fmtInt(goal.achieved_count)} <span style={{ color: '#7A8B9E', fontWeight: 400 }}>of</span> {goal.target_count != null ? fmtInt(goal.target_count) : '-'} New Researchers
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <RadialProgress pct={pct} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <div style={{ fontSize: '0.69rem', color: '#7A8B9E', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Goal Progress</div>
          {goal.streak_months > 0 ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: '#2DD4BF', fontWeight: 700, fontSize: '0.75rem' }}><Flame size={12} aria-hidden /> {goal.streak_months} Month Streak!</span>
          ) : (
            <span style={{ fontSize: '0.75rem', color: '#FFFFFF', fontWeight: 600 }}>Keep Pushing!</span>
          )}
        </div>
      </div>
      {editing ? (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
          <input ref={inputRef} type="number" min="0" value={val} onChange={e => setVal(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') void handleSave(); if (e.key === 'Escape') setEditing(false); }}
            style={{ width: 80, padding: '7px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(0,196,188,0.40)', color: '#FFFFFF', fontSize: '0.82rem', outline: 'none' }}
            placeholder="Target" />
          <button type="button" onClick={() => void handleSave()} disabled={saving}
            style={{ padding: '7px 12px', borderRadius: 8, background: 'rgba(0,196,188,0.16)', border: '1px solid rgba(0,196,188,0.40)', color: '#00C4BC', fontSize: '0.74rem', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}>
            {saving ? '...' : 'Save'}
          </button>
          <button type="button" onClick={() => setEditing(false)} style={{ padding: '7px 8px', borderRadius: 8, background: 'transparent', border: '1px solid rgba(255,255,255,0.10)', color: '#7A8B9E', fontSize: '0.74rem', cursor: 'pointer' }}>
            <X size={13} />
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => { setVal(String(goal.target_count ?? '')); setEditing(true); }}
          style={{ padding: '8px 16px', borderRadius: 10, background: 'rgba(0,196,188,0.08)', border: '1px solid rgba(0,196,188,0.30)', color: '#00C4BC', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', transition: 'background 0.15s', flexShrink: 0 }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,196,188,0.18)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,196,188,0.08)'; }}>
          {goal.target_count != null ? 'Edit Goal' : 'Set Goal'}
        </button>
      )}
    </div>
  );
}

/* -----------------------------------------------------------------------
   Filter chip + Tab button
----------------------------------------------------------------------- */

function FilterChip({ active, onClick, children, count }: { active: boolean; onClick: () => void; children: React.ReactNode; count?: number }) {
  return (
    <button type="button" onClick={onClick} style={{ padding: '6px 13px', borderRadius: 999, background: active ? 'rgba(0,196,188,0.15)' : 'rgba(255,255,255,0.04)', border: `1px solid ${active ? 'rgba(0,196,188,0.48)' : 'rgba(255,255,255,0.09)'}`, color: active ? '#00C4BC' : '#B0B8C4', fontSize: '0.73rem', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap', transition: 'all 0.15s' }}>
      {children}
      {count !== undefined && <span style={{ background: active ? 'rgba(0,196,188,0.25)' : 'rgba(255,255,255,0.08)', padding: '0 6px', borderRadius: 999, fontSize: '0.64rem', fontWeight: 800 }}>{fmtInt(count)}</span>}
    </button>
  );
}

function TabBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button type="button" onClick={onClick} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 15px', borderRadius: 10, background: active ? 'rgba(0,196,188,0.14)' : 'transparent', border: `1px solid ${active ? 'rgba(0,196,188,0.38)' : 'rgba(255,255,255,0.05)'}`, color: active ? '#00C4BC' : '#B0B8C4', fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s' }}>
      {icon}{label}
    </button>
  );
}

/* -----------------------------------------------------------------------
   Inline tag input
----------------------------------------------------------------------- */

function InlineTagInput({ onAdd, onCancel }: { onAdd: (tag: string) => Promise<void>; onCancel: () => void }) {
  const [val, setVal] = useState('');
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);
  const submit = async () => {
    const t = val.trim().slice(0, 32);
    if (!t) return;
    setSaving(true);
    await onAdd(t);
    setSaving(false);
  };
  return (
    <div style={{ display: 'flex', gap: 5, alignItems: 'center', marginTop: 6 }}>
      <input ref={ref} value={val} onChange={e => setVal(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') void submit(); if (e.key === 'Escape') onCancel(); }}
        placeholder="E.g. VIP" maxLength={32}
        style={{ flex: 1, padding: '6px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(0,196,188,0.35)', color: '#FFFFFF', fontSize: '0.78rem', outline: 'none', minWidth: 0 }} />
      <button type="button" onClick={() => void submit()} disabled={saving || !val.trim()}
        style={{ padding: '6px 11px', borderRadius: 8, background: 'rgba(0,196,188,0.14)', border: '1px solid rgba(0,196,188,0.38)', color: '#00C4BC', fontSize: '0.74rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
        {saving ? '...' : 'Add'}
      </button>
      <button type="button" onClick={onCancel} style={{ padding: '6px 8px', borderRadius: 8, background: 'transparent', border: '1px solid rgba(255,255,255,0.10)', color: '#7A8B9E', cursor: 'pointer' }}><X size={12} /></button>
    </div>
  );
}

/* -----------------------------------------------------------------------
   Inline note editor
----------------------------------------------------------------------- */

function NoteEditor({ researcherId, initialNote, onSave }: { researcherId: string; initialNote: string; onSave: (note: string) => void }) {
  const [val, setVal] = useState(initialNote);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/agent/researchers/notes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ researcherId, note: val }),
      });
      if (!res.ok) throw new Error('Failed');
      onSave(val);
      setDirty(false);
      toast.success('Note Saved');
    } catch {
      toast.error('Could Not Save Note');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.66rem', color: '#7A8B9E', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        <StickyNote size={11} /> Private Note
      </div>
      <textarea value={val} rows={3}
        onChange={e => { setVal(e.target.value); setDirty(true); }}
        placeholder="Add A Private Note About This Researcher..."
        style={{ resize: 'vertical', padding: '9px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)', color: '#E6EEF6', fontSize: '0.78rem', outline: 'none', lineHeight: 1.5, fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' }} />
      {dirty && (
        <div style={{ display: 'flex', gap: 6 }}>
          <button type="button" onClick={() => void handleSave()} disabled={saving}
            style={{ padding: '6px 14px', borderRadius: 8, background: 'rgba(0,196,188,0.14)', border: '1px solid rgba(0,196,188,0.38)', color: '#00C4BC', fontSize: '0.74rem', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}>
            {saving ? 'Saving...' : 'Save Note'}
          </button>
          <button type="button" onClick={() => { setVal(initialNote); setDirty(false); }}
            style={{ padding: '6px 10px', borderRadius: 8, background: 'transparent', border: '1px solid rgba(255,255,255,0.10)', color: '#7A8B9E', fontSize: '0.74rem', cursor: 'pointer' }}>
            Discard
          </button>
        </div>
      )}
    </div>
  );
}

/* -----------------------------------------------------------------------
   Researcher row (table + expanded detail)
----------------------------------------------------------------------- */

function ResearcherRow({ r, expanded, onExpand, selected, onToggleSelect, onMessage, onAddTag, onRemoveTag, onAddReminder, onTogglePin, isSuperAgent, onResetPassword, onPromote, onToggleAutoApprove, onNoteUpdate }: {
  r: Researcher; expanded: boolean; onExpand: () => void;
  selected?: boolean; onToggleSelect?: () => void;
  onMessage: (r: Researcher) => void;
  onAddTag: (r: Researcher) => void;
  onRemoveTag: (r: Researcher, tag: string) => void;
  onAddReminder: (r: Researcher) => void;
  onTogglePin: (r: Researcher) => void;
  isSuperAgent?: boolean;
  onResetPassword?: (r: { id: string; name: string; username: string }) => void;
  onPromote?: (r: Researcher) => void;
  onToggleAutoApprove?: (id: string, current: boolean) => void;
  onNoteUpdate: (id: string, note: string) => void;
}) {
  const [addingTag, setAddingTag] = useState(false);
  const s = STATUS_STYLES[r.status] ?? STATUS_STYLES.lead;
  const ob = onboardScore(r);
  const lastLogin = r.last_login ?? r.last_sign_in_at;

  return (
    <div style={{ borderBottom: '1px solid rgba(255,255,255,0.045)' }}>
      {/* Main row */}
      <div
        onClick={onExpand} role="button" tabIndex={0}
        onKeyDown={e => e.key === 'Enter' && onExpand()}
        style={{ display: 'grid', gridTemplateColumns: 'minmax(160px,2fr) 90px 80px 110px 100px 110px', alignItems: 'center', gap: 8, padding: '13px 16px', cursor: 'pointer', borderLeft: `3px solid ${selected ? '#00C4BC' : s.border}`, background: selected ? 'rgba(0,196,188,0.06)' : 'transparent', transition: 'background 0.13s' }}
        onMouseEnter={e => { e.currentTarget.style.background = selected ? 'rgba(0,196,188,0.10)' : 'rgba(255,255,255,0.022)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = selected ? 'rgba(0,196,188,0.06)' : 'transparent'; }}
        className="crm-row"
      >
        {/* Name + meta */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9, minWidth: 0 }}>
          {onToggleSelect && (
            <input type="checkbox" className="crm-checkbox" aria-label="Select Researcher"
              checked={!!selected} onClick={e => e.stopPropagation()} onChange={onToggleSelect}
              style={{ marginTop: 3 }} />
          )}
          <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, color: '#FFFFFF', fontSize: '0.88rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              {r.is_pinned && <Pin size={10} color="#00C4BC" aria-hidden />}
              {r.has_open_reminder && <Bell size={10} color="#2DD4BF" aria-hidden />}
              {r.full_name || r.username || r.email || 'Researcher'}
            </span>
            {/* Onboarding badge */}
            {ob.score < 100 && (
              <span style={{ fontSize: '0.6rem', fontWeight: 700, color: ob.color, background: `${ob.color}18`, border: `1px solid ${ob.color}44`, borderRadius: 999, padding: '1px 6px', whiteSpace: 'nowrap' }}>
                {ob.score}% Ready
              </span>
            )}
          </div>
          <span style={{ fontSize: '0.7rem', color: '#5A6A7A', display: 'block' }}>@{r.username || '-'}</span>
          {r.tags.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 3 }}>
              {r.tags.map(t => <span key={t.id} style={{ fontSize: '0.6rem', padding: '1px 6px', borderRadius: 999, background: 'rgba(0,196,188,0.10)', border: '1px solid rgba(0,196,188,0.28)', color: '#00C4BC', fontWeight: 700 }}>{t.tag}</span>)}
            </div>
          )}
          </div>
        </div>

        {/* LTV */}
        <span style={{ fontWeight: 800, color: '#FFFFFF', fontSize: '0.86rem', textAlign: 'right' }}>{fmtUSD(r.lifetime_value)}</span>

        {/* Orders */}
        <span style={{ color: '#B0B8C4', fontSize: '0.80rem', textAlign: 'right' }}>{fmtInt(r.orders_count)}</span>

        {/* Last Login */}
        <span style={{ color: lastLogin ? '#B0B8C4' : '#EF4444', fontSize: '0.75rem', fontStyle: lastLogin ? 'normal' : 'italic' }}>
          {daysAgo(lastLogin)}
        </span>

        {/* Status */}
        <StatusBadge status={r.status} />

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 3 }} onClick={e => e.stopPropagation()}>
          <Tooltip text="Message"><button type="button" onClick={() => onMessage(r)} className="crm-icon-btn"><MessageSquare size={13} /></button></Tooltip>
          <Tooltip text="Add Tag"><button type="button" onClick={() => setAddingTag(v => !v)} className="crm-icon-btn"><TagIcon size={13} /></button></Tooltip>
          <Tooltip text="Reminder"><button type="button" onClick={() => onAddReminder(r)} className="crm-icon-btn"><Bell size={13} /></button></Tooltip>
          <Tooltip text={r.is_pinned ? 'Unpin' : 'Pin'}>
            <button type="button" onClick={() => onTogglePin(r)} className="crm-icon-btn">
              {r.is_pinned ? <PinOff size={13} /> : <Pin size={13} />}
            </button>
          </Tooltip>
        </div>
      </div>

      {/* Inline tag input */}
      {addingTag && (
        <div style={{ padding: '0 16px 10px 22px' }} onClick={e => e.stopPropagation()}>
          <InlineTagInput
            onAdd={async (tag) => { await onAddTag({ ...r, _tagInput: tag } as any); setAddingTag(false); }}
            onCancel={() => setAddingTag(false)}
          />
        </div>
      )}

      {/* Expanded panel */}
      {expanded && (
        <div className="glass-panel stagger-fade-in" style={{ padding: '20px', margin: '6px 12px 16px 12px', borderTop: 'none', position: 'relative' }}>

          {/* Top detail grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 16, marginBottom: 20 }}>
            {[
              { label: 'Joined', value: daysAgo(r.joined_at) },
              { label: 'Last Login', value: daysAgo(lastLogin), warn: !lastLogin },
              { label: 'Last Contacted', value: daysAgo(r.last_contacted_at) },
              { label: 'Last Order', value: daysAgo(r.last_order_at) },
              { label: 'Source', value: r.acquisition_source || 'Direct' },
            ].map(({ label, value, warn }) => (
              <div key={label}>
                <div style={{ fontSize: '0.63rem', color: '#5A6A7A', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3 }}>{label}</div>
                <div style={{ fontSize: '0.84rem', color: warn ? '#EF4444' : '#FFFFFF', fontWeight: 600 }}>{value}</div>
              </div>
            ))}
            {r.email && (
              <div>
                <div style={{ fontSize: '0.63rem', color: '#5A6A7A', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 3 }}>Email</div>
                <a href={`mailto:${r.email}`} style={{ fontSize: '0.84rem', color: '#00C4BC', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}><Mail size={11} /> {r.email}</a>
              </div>
            )}
            <div>
              <div style={{ fontSize: '0.63rem', color: '#5A6A7A', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>Churn Risk</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ flex: 1 }}><ChurnBar risk={r.churn_risk} /></div>
                <span style={{ fontSize: '0.76rem', color: '#B0B8C4', fontWeight: 700, flexShrink: 0 }}>{Math.round(safe(r.churn_risk))}%</span>
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.63rem', color: '#5A6A7A', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>Onboarding</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 999, overflow: 'hidden' }}>
                  <div style={{ width: `${ob.score}%`, height: '100%', background: ob.color, transition: 'width 300ms' }} />
                </div>
                <span style={{ fontSize: '0.74rem', color: ob.color, fontWeight: 700, flexShrink: 0 }}>{ob.score}%</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 8px', marginTop: 5, fontSize: '0.62rem', color: '#7A8B9E' }}>
                {[
                  { ok: !!r.full_name, label: 'Name' },
                  { ok: !!r.username, label: 'Username' },
                  { ok: !!(r.last_login ?? r.last_sign_in_at), label: 'Logged In' },
                  { ok: r.orders_count > 0, label: 'First Order' },
                ].map(({ ok, label }) => (
                  <span key={label} style={{ color: ok ? '#00C4BC' : '#5A6A7A', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                    {ok ? <CheckCircle2 size={9} /> : '○'} {label}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Tags row */}
          {r.tags.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: '0.63rem', color: '#5A6A7A', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>Tags</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {r.tags.map(t => (
                  <span key={t.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.71rem', padding: '3px 10px', borderRadius: 999, background: 'rgba(0,196,188,0.09)', border: '1px solid rgba(0,196,188,0.28)', color: '#00C4BC', fontWeight: 700 }}>
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

          {/* Reminders */}
          {(r.reminders?.length ?? 0) > 0 && (
            <div style={{ marginBottom: 16, padding: '10px 12px', borderRadius: 10, background: 'rgba(45,212,191,0.06)', border: '1px solid rgba(45,212,191,0.18)' }}>
              <div style={{ fontSize: '0.63rem', color: '#2DD4BF', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 }}><Bell size={10} /> Upcoming Reminders</div>
              {r.reminders!.map(rem => (
                <div key={rem.id} style={{ fontSize: '0.78rem', color: '#E6EEF6', marginBottom: 2 }}>
                  • {rem.title} <span style={{ color: '#7A8B9E', fontSize: '0.70rem' }}> - {new Date(rem.remind_at).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          )}

          {/* Note */}
          <div style={{ marginBottom: 16 }}>
            <NoteEditor researcherId={r.id} initialNote={r.note ?? ''} onSave={(note) => onNoteUpdate(r.id, note)} />
          </div>

          {/* Admin controls */}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            {/* Auto-approve toggle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, opacity: (r.account_type === 'credit' || r.account_type === 'prepaid') ? 0.5 : 1 }}>
              <ToggleSwitch
                id={`auto-approve-${r.id}`}
                checked={!!r.auto_approve_orders}
                onChange={() => onToggleAutoApprove?.(r.id, !!r.auto_approve_orders)}
                disabled={r.account_type === 'credit' || r.account_type === 'prepaid'}
              />
              <span style={{ fontSize: '0.74rem', color: '#B0B8C4', fontWeight: 600 }}>Auto-Approve Orders</span>
            </div>

            <div style={{ flex: 1 }} />

            {/* Reset password */}
            {onResetPassword && (
              <button type="button"
                onClick={() => onResetPassword({ id: r.id, name: r.full_name || 'Researcher', username: r.username ?? '' })}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 13px', borderRadius: 9, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)', color: '#B0B8C4', fontSize: '0.74rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.09)'; e.currentTarget.style.color = '#FFFFFF'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#B0B8C4'; }}>
                <RefreshCw size={12} /> Reset Password
              </button>
            )}

            {/* Promote to Agent */}
            {isSuperAgent && onPromote && (
              <button type="button"
                onClick={() => onPromote(r)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 13px', borderRadius: 9, background: 'rgba(0,196,188,0.08)', border: '1px solid rgba(0,196,188,0.28)', color: '#00C4BC', fontSize: '0.74rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,196,188,0.16)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,196,188,0.08)'; }}>
                <UserCheck size={12} /> Promote To Agent
              </button>
            )}

            {/* Message */}
            <button type="button"
              onClick={() => onMessage(r)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 13px', borderRadius: 9, background: 'rgba(0,196,188,0.10)', border: '1px solid rgba(0,196,188,0.30)', color: '#00C4BC', fontSize: '0.74rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,196,188,0.20)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,196,188,0.10)'; }}>
              <MessageSquare size={12} /> Message
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* -----------------------------------------------------------------------
   Activity feed
----------------------------------------------------------------------- */

function ActivityFeed({ items }: { items: ActivityItem[] }) {
  const [open, setOpen] = useState(false);
  if (items.length === 0) return null;
  const visible = open ? items : items.slice(0, 5);
  return (
    <div style={{ borderRadius: 16, background: 'linear-gradient(160deg, rgba(18,26,42,0.97) 0%, rgba(12,18,30,0.97) 100%)', border: '1px solid rgba(255,255,255,0.07)', overflow: 'hidden', marginTop: 8 }}>
      <button type="button" onClick={() => setOpen(v => !v)}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: 'transparent', border: 0, color: '#FFFFFF', padding: '14px 18px', cursor: 'pointer', borderBottom: open ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: '0.82rem' }}>
          <ActivityIcon size={14} color="#00C4BC" aria-hidden /> Recent Activity
          <span style={{ fontSize: '0.68rem', color: '#5A6A7A', fontWeight: 400 }}>({items.length})</span>
        </span>
        {open ? <ChevronUp size={14} color="#5A6A7A" /> : <ChevronDown size={14} color="#5A6A7A" />}
      </button>
      {open && (
        <ul style={{ listStyle: 'none', padding: '0 18px', margin: 0, display: 'flex', flexDirection: 'column' }}>
          {visible.map((a, i) => (
            <li key={a.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 0', borderTop: i > 0 ? '1px solid rgba(255,255,255,0.04)' : 'none', fontSize: '0.78rem', color: '#B0B8C4' }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                <strong style={{ color: '#FFFFFF' }}>{a.researcher_name}</strong>
                {a.meta ? ` - ${a.meta}` : ''}
              </span>
              <span style={{ color: '#5A6A7A', fontSize: '0.71rem', whiteSpace: 'nowrap' }}>{daysAgo(a.at)}</span>
            </li>
          ))}
        </ul>
      )}
      {!open && items.length > 5 && (
        <div style={{ padding: '10px 18px', textAlign: 'center' }}>
          <button type="button" onClick={() => setOpen(true)} style={{ background: 'none', border: 'none', color: '#00C4BC', fontSize: '0.74rem', cursor: 'pointer' }}>
            Show All {items.length}
          </button>
        </div>
      )}
    </div>
  );
}

/* -----------------------------------------------------------------------
   Empty state
----------------------------------------------------------------------- */

function EmptyState({ slug }: { slug: string | null }) {
  const url = typeof window !== 'undefined' && slug ? `${window.location.origin}/${slug}` : slug ? `/${slug}` : null;
  const onCopy = useCallback(() => { if (!url) return; void navigator.clipboard.writeText(url); toast.success('Storefront Link Copied'); }, [url]);
  return (
    <div style={{ padding: '48px 24px', borderRadius: 16, background: 'linear-gradient(160deg, rgba(16,24,40,0.96) 0%, rgba(11,17,28,0.96) 100%)', border: '1px dashed rgba(0,196,188,0.22)', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
      <div style={{ width: 52, height: 52, borderRadius: 14, background: 'rgba(0,196,188,0.10)', border: '1px solid rgba(0,196,188,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Sparkles size={22} color="#00C4BC" />
      </div>
      <div>
        <div style={{ fontSize: '1.1rem', color: '#FFFFFF', fontWeight: 800, marginBottom: 8 }}>No Researchers Yet</div>
        <p style={{ color: '#7A8B9E', fontSize: '0.83rem', maxWidth: 420, lineHeight: 1.55, margin: 0 }}>
          Your CRM activates the moment your first researcher joins. Share your storefront, create an account above, and watch this page light up.
        </p>
      </div>
      {url && <button type="button" onClick={onCopy} style={{ padding: '10px 22px', borderRadius: 10, background: 'rgba(0,196,188,0.12)', border: '1px solid rgba(0,196,188,0.38)', color: '#00C4BC', fontSize: '0.83rem', fontWeight: 700, cursor: 'pointer' }}>Copy Storefront Link</button>}
    </div>
  );
}

/* -----------------------------------------------------------------------
   Getting-started strip (shown while the account is still ramping up)
----------------------------------------------------------------------- */

function GettingStarted({ slug, researcherCount }: { slug: string | null; researcherCount: number }) {
  const url = typeof window !== 'undefined' && slug ? `${window.location.origin}/${slug}` : slug ? `https://pepnationlab.com/${slug}` : null;
  const onCopy = useCallback(() => { if (!url) return; void navigator.clipboard.writeText(url); toast.success('Storefront Link Copied'); }, [url]);

  const steps: { icon: React.ReactNode; title: string; done: boolean; hint: string }[] = [
    { icon: <UserPlus size={14} />, title: 'Add Researchers', done: researcherCount > 0, hint: 'Use "Create Researcher Account" above or share your link.' },
    { icon: <Share2 size={14} />, title: 'Share Your Storefront', done: false, hint: 'Send your link so researchers can browse and order.' },
    { icon: <ShoppingBag size={14} />, title: 'Land The First Order', done: false, hint: 'Your revenue metrics light up on the first order.' },
  ];

  return (
    <div style={{ borderRadius: 14, background: 'linear-gradient(160deg, rgba(0,196,188,0.06) 0%, rgba(14,22,34,0.85) 60%)', border: '1px solid rgba(0,196,188,0.20)', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: 8, background: 'rgba(0,196,188,0.14)', flexShrink: 0 }}>
          <Rocket size={16} color="#00C4BC" aria-hidden />
        </span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '0.95rem', fontWeight: 800, color: '#FFFFFF' }}>Getting Started</div>
          <div style={{ fontSize: '0.76rem', color: '#7A8B9E' }}>A Few Steps To Get Your Team Active And Ordering</div>
        </div>
      </div>

      {url && (
        <div className="crm-getstarted-link" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 10, padding: '8px 12px' }}>
          <LinkIcon size={13} color="#2DD4BF" aria-hidden />
          <span style={{ fontSize: '0.78rem', color: '#D0DAE4', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: '1 1 160px', minWidth: 0 }}>{url}</span>
          <button type="button" onClick={onCopy}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8, background: 'rgba(0,196,188,0.14)', border: '1px solid rgba(0,196,188,0.34)', color: '#00C4BC', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            <Copy size={12} /> Copy
          </button>
          <a href={url} target="_blank" rel="noopener noreferrer"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)', color: '#B0B8C4', fontSize: '0.72rem', fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap' }}>
            <ArrowUpRight size={12} /> Open
          </a>
        </div>
      )}

      <div className="crm-getstarted-steps" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 10 }}>
        {steps.map((st, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 7, flexShrink: 0, background: st.done ? 'rgba(0,196,188,0.16)' : 'rgba(255,255,255,0.05)', color: st.done ? '#00C4BC' : '#7A8B9E' }}>
              {st.done ? <CheckCircle2 size={15} /> : st.icon}
            </span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: st.done ? '#2DD4BF' : '#FFFFFF' }}>{st.title}</div>
              <div style={{ fontSize: '0.7rem', color: '#7A8B9E', lineHeight: 1.4, marginTop: 1 }}>{st.hint}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* -----------------------------------------------------------------------
   Main component
----------------------------------------------------------------------- */

export default function AgentResearcherCRMv2({
  isSuperAgent, onResetPassword, onPromote, onToggleAutoApprove,
}: CRMExternalProps) {
  const router = useRouter();
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortKey>('ltv');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>('list');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Keep typing responsive on large lists: the input updates immediately while
  // the (potentially expensive) filter/sort recompute lags one frame behind.
  const deferredSearch = useDeferredValue(search);
  // Cap rendered rows so the DOM stays light for agents with big teams.
  const PAGE_SIZE = 30;
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const toggleSelect = useCallback((id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);
  const clearSelection = useCallback(() => setSelected(new Set()), []);

  const insights = useInsights(tab === 'charts' || tab === 'acquisition');

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const r = await fetch('/api/agent/researchers/v2', { cache: 'no-store' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const raw = await r.json() as any;
      // Normalise field names - API uses created_at/last_sign_in_at, UI uses joined_at/last_login
      if (raw.researchers) {
        raw.researchers = raw.researchers.map((r: any) => ({
          ...r,
          joined_at: r.joined_at ?? r.created_at,
          last_login: r.last_login ?? r.last_sign_in_at,
          lifetime_value: r.lifetime_value ?? r.total_spent ?? 0,
          orders_count: r.orders_count ?? r.order_count ?? 0,
          tags: (r.tags ?? []).map((t: any, i: number) => ({ id: t.id ?? `${r.id}-${i}`, tag: t.tag ?? t, color: t.color ?? null })),
          has_open_reminder: Array.isArray(r.reminders) && r.reminders.length > 0,
          account_type: (r as any).account_type,
        }));
      }
      setData(raw as Payload);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could Not Load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  /* -- API actions -- */
  const togglePin = useCallback(async (r: Researcher) => {
    const res = await fetch('/api/agent/researchers/pins', { method: r.is_pinned ? 'DELETE' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ researcherId: r.id }) });
    if (!res.ok) { toast.error('Could Not Update Pin'); return; }
    toast.success(r.is_pinned ? 'Pin Removed' : 'Pinned');
    void refresh();
  }, [refresh]);

  const addTag = useCallback(async (r: any) => {
    const tag = r._tagInput ?? '';
    if (!tag) return;
    const res = await fetch('/api/agent/researchers/tags', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ researcherId: r.id, tag }) });
    if (!res.ok) { toast.error('Could Not Save Tag'); return; }
    toast.success('Tag Added');
    void refresh();
  }, [refresh]);

  const removeTag = useCallback(async (r: Researcher, tag: string) => {
    const res = await fetch('/api/agent/researchers/tags', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ researcherId: r.id, tag }) });
    if (!res.ok) { toast.error('Could Not Remove Tag'); return; }
    void refresh();
  }, [refresh]);

  const message = useCallback((r: Researcher | { id: string }) => {
    router.push(`/messenger?participant=${encodeURIComponent(r.id)}`);
  }, [router]);

  const [reminderTarget, setReminderTarget] = useState<Researcher | null>(null);
  const [reminderTitle, setReminderTitle] = useState('');
  const [reminderDays, setReminderDays] = useState('7');
  const [reminderSaving, setReminderSaving] = useState(false);

  const addReminder = useCallback((r: Researcher) => {
    setReminderTarget(r);
    setReminderTitle('');
    setReminderDays('7');
  }, []);

  const submitReminder = useCallback(async () => {
    if (!reminderTarget || !reminderTitle.trim()) { toast.error('Please Enter A Reminder Title'); return; }
    const days = Math.max(1, parseInt(reminderDays, 10) || 7);
    setReminderSaving(true);
    try {
      const res = await fetch('/api/agent/researchers/reminders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ researcherId: reminderTarget.id, title: reminderTitle.trim().slice(0, 200), remindAt: new Date(Date.now() + days * 86400000).toISOString() }) });
      if (!res.ok) { toast.error('Could Not Save Reminder'); return; }
      toast.success(`Reminder Set For ${days} Day${days !== 1 ? 's' : ''}`);
      setReminderTarget(null);
      void refresh();
    } finally {
      setReminderSaving(false);
    }
  }, [reminderTarget, reminderTitle, reminderDays, refresh]);

  const setGoal = useCallback(async (n: number) => {
    const res = await fetch('/api/agent/researchers/goals', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ targetCount: n }) });
    if (!res.ok) { toast.error('Could Not Save Goal'); return; }
    toast.success('Goal Saved');
    void refresh();
  }, [refresh]);

  const updateNote = useCallback((id: string, note: string) => {
    setData(prev => prev ? { ...prev, researchers: prev.researchers.map(r => r.id === id ? { ...r, note } : r) } : prev);
  }, []);

  const handleAutoApprove = useCallback((researcherId: string, current: boolean) => {
    onToggleAutoApprove?.(researcherId, current);
    setData(prev => prev ? { ...prev, researchers: prev.researchers.map(r => r.id === researcherId ? { ...r, auto_approve_orders: !current } : r) } : prev);
  }, [onToggleAutoApprove]);

  const handlePromote = useCallback((r: Researcher) => {
    onPromote?.({ id: r.id, full_name: r.full_name, username: r.username, email: r.email, created_at: r.joined_at, auto_approve_orders: r.auto_approve_orders });
  }, [onPromote]);

  const messageNeverLoggedIn = useCallback(() => {
    if (!data) return;
    const ids = data.researchers.filter(r => !(r.last_login ?? r.last_sign_in_at)).map(r => r.id);
    if (ids.length === 0) { toast('No Un-Activated Researchers'); return; }
    router.push(`/messenger?participants=${encodeURIComponent(ids.join(','))}`);
  }, [data, router]);

  const bulkMessage = useCallback(() => {
    if (selected.size === 0) return;
    router.push(`/messenger?participants=${encodeURIComponent(Array.from(selected).join(','))}`);
  }, [selected, router]);

  const bulkPin = useCallback(async () => {
    if (!data || selected.size === 0) return;
    const targets = data.researchers.filter(r => selected.has(r.id) && !r.is_pinned);
    if (targets.length === 0) { toast('Selected Researchers Are Already Pinned'); return; }
    await Promise.allSettled(targets.map(r =>
      fetch('/api/agent/researchers/pins', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ researcherId: r.id }) }),
    ));
    toast.success(`Pinned ${targets.length} Researcher${targets.length !== 1 ? 's' : ''}`);
    clearSelection();
    void refresh();
  }, [data, selected, clearSelection, refresh]);

  const clearFilters = useCallback(() => { setFilter('all'); setSearch(''); }, []);

  /* -- Filtering + sorting -- */
  const filtered = useMemo(() => {
    if (!data) return [];
    const term = deferredSearch.trim().toLowerCase();
    const base = data.researchers.filter(r => {
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
    const searched = term ? base.filter(r => (r.full_name ?? '').toLowerCase().includes(term) || (r.username ?? '').toLowerCase().includes(term) || (r.email ?? '').toLowerCase().includes(term)) : base;
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...searched].sort((a, b) => {
      switch (sortBy) {
        case 'name': return (a.full_name ?? '').localeCompare(b.full_name ?? '') * dir;
        case 'orders': return (a.orders_count - b.orders_count) * dir;
        case 'last': return (new Date(a.last_order_at ?? 0).getTime() - new Date(b.last_order_at ?? 0).getTime()) * dir;
        case 'joined': return (new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime()) * dir;
        case 'risk': return (a.churn_risk - b.churn_risk) * dir;
        case 'login': return (new Date(a.last_login ?? a.last_sign_in_at ?? 0).getTime() - new Date(b.last_login ?? b.last_sign_in_at ?? 0).getTime()) * dir;
        default: return (a.lifetime_value - b.lifetime_value) * dir;
      }
    });
  }, [data, filter, deferredSearch, sortBy, sortDir]);

  const kanbanRows: KanbanResearcher[] = useMemo(() => (data?.researchers ?? []).map(r => ({ id: r.id, full_name: r.full_name, username: r.username, lifetime_value: r.lifetime_value, orders_count: r.orders_count, last_order_at: r.last_order_at, status: r.status, churn_risk: r.churn_risk })), [data]);

  const neverLoggedIn = useMemo(() => (data?.researchers ?? []).filter(r => !(r.last_login ?? r.last_sign_in_at)).length, [data]);

  function sortBtn(key: SortKey, label: string) {
    return (
      <button type="button" onClick={() => { setSortBy(key); setSortDir(d => sortBy === key && d === 'desc' ? 'asc' : 'desc'); }}
        style={{ background: 'transparent', border: 0, color: sortBy === key ? '#00C4BC' : '#7A8B9E', fontSize: '0.66rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', cursor: 'pointer', font: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 2 }}>
        {label}{sortBy === key ? (sortDir === 'desc' ? ' ↓' : ' ↑') : ''}
      </button>
    );
  }

  /* -- Render states -- */
  if (loading && !data) {
    return (
      <div style={{ padding: '24px 0' }}>
        <SkeletonGrid />
      </div>
    );
  }
  if (error) {
    return (
      <div style={{ padding: '20px', color: '#EF4444', display: 'flex', alignItems: 'center', gap: 12, borderRadius: 12, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.20)' }}>
        <AlertTriangle size={15} /> {error}
        <button type="button" onClick={() => void refresh()} style={{ marginLeft: 8, padding: '5px 12px', borderRadius: 7, background: 'rgba(0,196,188,0.10)', border: '1px solid rgba(0,196,188,0.35)', color: '#00C4BC', cursor: 'pointer', fontSize: '0.76rem', fontWeight: 700 }}>Retry</button>
      </div>
    );
  }
  if (!data) return null;

  const k = data.kpis;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }} className="crm-shell">

      {/* Goal header */}
      <GoalHeader goal={data.goal} onSetGoal={setGoal} />

      {/* Never-logged-in nudge banner */}
      {neverLoggedIn > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '12px 18px', borderRadius: 12, background: 'rgba(0,196,188,0.05)', border: '1px solid rgba(0,196,188,0.20)', borderLeft: '3px solid #00C4BC', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 7, background: 'rgba(0,196,188,0.12)', flexShrink: 0 }}>
              <UserPlus size={14} color="#2DD4BF" aria-hidden />
            </span>
            <span style={{ fontSize: '0.8rem', color: '#FFFFFF', fontWeight: 700 }}>
              {neverLoggedIn} Researcher{neverLoggedIn !== 1 ? 's' : ''} Haven&apos;t Logged In Yet
            </span>
            <span style={{ fontSize: '0.75rem', color: '#7A8B9E' }}>- They Haven&apos;t Activated Their Account</span>
          </div>
          <button type="button" onClick={messageNeverLoggedIn}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 9, background: 'rgba(0,196,188,0.14)', border: '1px solid rgba(0,196,188,0.34)', color: '#00C4BC', fontSize: '0.74rem', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            <MessageSquare size={12} /> Message All
          </button>
        </div>
      )}

      {/* Getting-started strip — while the account is still ramping up */}
      {data.researchers.length > 0 && safe(k.total_orders.value) === 0 && (
        <GettingStarted slug={data.storefront_slug} researcherCount={data.researchers.length} />
      )}

      {/* KPI grid */}
      <div className="crm-kpi-grid" style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fill, minmax(185px, 1fr))' }}>
        <KpiCard label="Total Researchers" value={fmtInt(k.researchers_count.value)} spark={k.researchers_count.spark ?? []} delta={k.researchers_count.delta_pct} onClick={() => { setTab('list'); setFilter('all'); }} />
        <KpiCard label="Lifetime Revenue" value={fmtUSD(k.lifetime_value.value)} spark={k.lifetime_value.spark ?? []} delta={k.lifetime_value.delta_pct} color="#00C4BC" muted={safe(k.lifetime_value.value) === 0} />
        <KpiCard label="Total Orders" value={fmtInt(k.total_orders.value)} spark={k.total_orders.spark ?? []} delta={k.total_orders.delta_pct} color="#2DD4BF" muted={safe(k.total_orders.value) === 0} />
        <KpiCard label="Active Buyers" value={fmtInt(k.active_buyers.value)} spark={k.active_buyers.spark ?? []} delta={k.active_buyers.delta_pct} onClick={() => { setTab('list'); setFilter('all'); }} muted={safe(k.active_buyers.value) === 0} />
        <KpiCard label="Avg Order Value" value={fmtUSD(k.avg_order_value.value)} spark={k.avg_order_value.spark ?? []} delta={k.avg_order_value.delta_pct} color="#2DD4BF" muted={safe(k.avg_order_value.value) === 0} />
        <KpiCard label="Repeat Rate" value={`${Math.round(safe(k.repeat_rate.value))}%`} spark={k.repeat_rate.spark ?? []} delta={k.repeat_rate.delta_pct} color="#5EEAD4" muted={safe(k.repeat_rate.value) === 0} />
        <KpiCard label="New This Month" value={fmtInt(k.new_this_month.value)} spark={k.new_this_month.spark ?? []} delta={k.new_this_month.delta_pct} onClick={() => { setTab('list'); setFilter('new'); }} />
        <KpiCard label="At Risk" value={fmtInt(k.at_risk.value)} spark={k.at_risk.spark ?? []} delta={k.at_risk.delta_pct} color="#F87171" onClick={() => { setTab('list'); setFilter('at_risk'); }} muted={safe(k.at_risk.value) === 0} />
        <KpiCard label="Best Researcher" value={k.best_customer?.label || '-'} spark={k.best_customer?.spark ?? []} delta={k.best_customer?.delta_pct} color="#D0DAE4" subtitle={(k.best_customer?.value ?? 0) > 0 ? fmtUSD(k.best_customer!.value) : undefined} muted={!k.best_customer?.label} />
        <KpiCard label="Commission Earned" value={fmtUSD(k.lifetime_commission.value)} spark={k.lifetime_commission.spark ?? []} delta={k.lifetime_commission.delta_pct} color="#2DD4BF" />
      </div>

      {/* Tab bar */}
      <div role="tablist" aria-label="Researcher CRM View" style={{ display: 'flex', gap: 5, padding: '4px', background: 'rgba(10,16,28,0.80)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 13, overflowX: 'auto' }}>
        <TabBtn active={tab === 'list'} onClick={() => setTab('list')} icon={<TableIcon size={13} aria-hidden />} label="Researchers" />
        <TabBtn active={tab === 'kanban'} onClick={() => setTab('kanban')} icon={<LayoutGrid size={13} aria-hidden />} label="Kanban" />
        <TabBtn active={tab === 'charts'} onClick={() => setTab('charts')} icon={<BarChart3 size={13} aria-hidden />} label="Charts" />
        <TabBtn active={tab === 'acquisition'} onClick={() => setTab('acquisition')} icon={<GitBranch size={13} aria-hidden />} label="Acquisition" />
      </div>

      {/* List tab */}
      {tab === 'list' && (
        <>
          {/* Filters + search */}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 7 }}>
            <FilterChip active={filter === 'all'} onClick={() => setFilter('all')} count={data.researchers.length}>All</FilterChip>
            <FilterChip active={filter === 'vip'} onClick={() => setFilter('vip')} count={data.kanban_counts.vip}>VIPs</FilterChip>
            <FilterChip active={filter === 'at_risk'} onClick={() => setFilter('at_risk')} count={(data.kanban_counts.at_risk ?? 0) + (data.kanban_counts.churned ?? 0)}>At Risk</FilterChip>
            <FilterChip active={filter === 'new'} onClick={() => setFilter('new')} count={(data.kanban_counts.new ?? 0) + (data.kanban_counts.first_order ?? 0)}>New</FilterChip>
            <FilterChip active={filter === 'inactive'} onClick={() => setFilter('inactive')} count={data.kanban_counts.lead}>Inactive</FilterChip>
            <FilterChip active={filter === 'pinned'} onClick={() => setFilter('pinned')} count={data.researchers.filter(r => r.is_pinned).length}>Pinned</FilterChip>
            {(filter !== 'all' || search.trim() !== '') && (
              <button type="button" onClick={clearFilters} title="Clear Filters"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '6px 11px', borderRadius: 999, background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', color: '#7A8B9E', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}>
                <XCircle size={12} /> Clear
              </button>
            )}
            <div style={{ flex: 1 }} />
            <div className="crm-filter-search" style={{ display: 'flex', alignItems: 'center', gap: 7, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 10, padding: '0 11px', minWidth: 200, flex: '0 1 240px' }}>
              <Search size={13} color="#7A8B9E" aria-hidden />
              <input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search Name, Email, Username"
                style={{ border: 0, background: 'transparent', color: '#FFFFFF', padding: '9px 0', fontSize: '0.77rem', outline: 'none', width: '100%' }} />
            </div>
            <button type="button" onClick={() => { window.location.href = '/api/agent/researchers/export'; }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '9px 13px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', color: '#B0B8C4', fontSize: '0.73rem', fontWeight: 700, cursor: 'pointer' }}>
              <Download size={12} /> CSV
            </button>
            <button type="button" onClick={() => window.print()} title="Print / Save PDF"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '9px 13px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', color: '#B0B8C4', fontSize: '0.73rem', fontWeight: 700, cursor: 'pointer' }}>
              <Printer size={12} /> PDF
            </button>
          </div>

          {/* Bulk action bar */}
          {selected.size > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '10px 14px', borderRadius: 12, background: 'rgba(0,196,188,0.08)', border: '1px solid rgba(0,196,188,0.28)' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#00C4BC' }}>{selected.size} Selected</span>
              <div style={{ flex: 1 }} />
              <button type="button" onClick={bulkMessage}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 13px', borderRadius: 9, background: 'rgba(0,196,188,0.14)', border: '1px solid rgba(0,196,188,0.34)', color: '#00C4BC', fontSize: '0.73rem', fontWeight: 700, cursor: 'pointer' }}>
                <MessageSquare size={12} /> Message
              </button>
              <button type="button" onClick={() => void bulkPin()}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 13px', borderRadius: 9, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', color: '#B0B8C4', fontSize: '0.73rem', fontWeight: 700, cursor: 'pointer' }}>
                <Pin size={12} /> Pin
              </button>
              <button type="button" onClick={clearSelection}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 13px', borderRadius: 9, background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', color: '#7A8B9E', fontSize: '0.73rem', fontWeight: 700, cursor: 'pointer' }}>
                <XCircle size={12} /> Clear
              </button>
            </div>
          )}

          {/* Table */}
          {data.researchers.length === 0 ? (
            <EmptyState slug={data.storefront_slug} />
          ) : (
            <div style={{ borderRadius: 16, overflow: 'hidden', background: 'linear-gradient(160deg, rgba(16,24,40,0.97) 0%, rgba(10,16,28,0.97) 100%)', border: '1px solid rgba(255,255,255,0.07)', boxShadow: '0 4px 28px rgba(0,0,0,0.30)' }}>
              {/* Header */}
              <div role="row" style={{ display: 'grid', gridTemplateColumns: 'minmax(160px,2fr) 90px 80px 110px 100px 110px', alignItems: 'center', gap: 8, padding: '9px 16px', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.06)' }} className="crm-row-head">
                <span role="columnheader" aria-sort={sortBy === 'name' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <input type="checkbox" className="crm-checkbox" aria-label="Select All"
                    checked={filtered.length > 0 && filtered.every(r => selected.has(r.id))}
                    ref={el => { if (el) el.indeterminate = selected.size > 0 && !filtered.every(r => selected.has(r.id)); }}
                    onChange={e => {
                      setSelected(prev => {
                        const next = new Set(prev);
                        if (e.target.checked) filtered.forEach(r => next.add(r.id));
                        else filtered.forEach(r => next.delete(r.id));
                        return next;
                      });
                    }} />
                  {sortBtn('name', 'Researcher')}
                </span>
                <span role="columnheader" aria-sort={sortBy === 'ltv' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'} style={{ textAlign: 'right' }}>{sortBtn('ltv', 'LTV')}</span>
                <span role="columnheader" aria-sort={sortBy === 'orders' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'} style={{ textAlign: 'right' }}>{sortBtn('orders', 'Orders')}</span>
                <span role="columnheader" aria-sort={sortBy === 'login' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}>{sortBtn('login', 'Last Login')}</span>
                <span style={{ fontSize: '0.66rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#5A6A7A' }}>Status</span>
                <span style={{ textAlign: 'right', fontSize: '0.66rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#5A6A7A' }}>Actions</span>
              </div>

              {filtered.length === 0 ? (
                <div style={{ padding: '32px', textAlign: 'center', color: '#5A6A7A', fontSize: '0.83rem' }}>No Researchers Match This Filter.</div>
              ) : (
                filtered.slice(0, visibleCount).map(r => (
                  <ResearcherRow key={r.id} r={r}
                    expanded={expandedId === r.id}
                    onExpand={() => setExpandedId(id => id === r.id ? null : r.id)}
                    selected={selected.has(r.id)}
                    onToggleSelect={() => toggleSelect(r.id)}
                    onMessage={message} onAddTag={addTag} onRemoveTag={removeTag}
                    onAddReminder={addReminder} onTogglePin={togglePin}
                    isSuperAgent={isSuperAgent} onResetPassword={onResetPassword}
                    onPromote={handlePromote} onToggleAutoApprove={handleAutoApprove}
                    onNoteUpdate={updateNote}
                  />
                ))
              )}

              {filtered.length > visibleCount && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '14px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                  <span style={{ fontSize: '0.74rem', color: '#7A8B9E' }}>Showing {visibleCount} Of {filtered.length}</span>
                  <button type="button" onClick={() => setVisibleCount(v => v + PAGE_SIZE)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 16px', borderRadius: 9, background: 'rgba(0,196,188,0.12)', border: '1px solid rgba(0,196,188,0.34)', color: '#00C4BC', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>
                    <ChevronDown size={13} /> Load More
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {tab === 'kanban' && <div style={{ marginTop: 4 }}><KanbanView researchers={kanbanRows} onCardClick={id => { setTab('list'); setExpandedId(id); }} /></div>}
      {tab === 'charts' && <div style={{ marginTop: 4 }}><ChartsView revenueSpark={k.lifetime_value.spark ?? []} insights={insights} /></div>}
      {tab === 'acquisition' && <div style={{ marginTop: 4 }}><AcquisitionView sourceCounts={data.source_counts} funnel={insights?.funnel ?? null} /></div>}

      <ActivityFeed items={data.activity} />

      {/* Inline reminder modal */}
      {reminderTarget && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.65)', padding: 16 }} onClick={() => setReminderTarget(null)}>
          <div style={{ background: 'linear-gradient(160deg, rgba(18,26,42,0.99) 0%, rgba(12,18,30,0.99) 100%)', border: '1px solid rgba(0,196,188,0.28)', borderRadius: 16, padding: '24px 24px 20px', width: '100%', maxWidth: 400, boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#FFFFFF' }}>Set Reminder</span>
              <button type="button" onClick={() => setReminderTarget(null)} style={{ background: 'transparent', border: 0, color: '#7A8B9E', cursor: 'pointer', display: 'inline-flex' }}><X size={16} /></button>
            </div>
            <div style={{ fontSize: '0.75rem', color: '#7A8B9E', marginBottom: 14 }}>
              For: <strong style={{ color: '#FFFFFF' }}>{reminderTarget.full_name || reminderTarget.username || 'Researcher'}</strong>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: '0.68rem', color: '#7A8B9E', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 5 }}>Reminder Title</label>
                <input
                  autoFocus
                  type="text" maxLength={200} value={reminderTitle}
                  onChange={e => setReminderTitle(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') void submitReminder(); if (e.key === 'Escape') setReminderTarget(null); }}
                  placeholder="E.g. Follow Up On Last Order"
                  style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 9, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(0,196,188,0.30)', color: '#FFFFFF', fontSize: '0.83rem', outline: 'none' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.68rem', color: '#7A8B9E', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: 5 }}>Remind In (Days)</label>
                <input
                  type="number" min="1" max="365" value={reminderDays}
                  onChange={e => setReminderDays(e.target.value)}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 9, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', color: '#FFFFFF', fontSize: '0.83rem', outline: 'none' }}
                />
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button type="button" onClick={() => void submitReminder()} disabled={reminderSaving || !reminderTitle.trim()}
                  style={{ flex: 1, padding: '10px', borderRadius: 10, background: 'rgba(0,196,188,0.16)', border: '1px solid rgba(0,196,188,0.40)', color: '#00C4BC', fontSize: '0.80rem', fontWeight: 700, cursor: reminderSaving || !reminderTitle.trim() ? 'not-allowed' : 'pointer', opacity: reminderSaving || !reminderTitle.trim() ? 0.6 : 1 }}>
                  {reminderSaving ? 'Saving...' : 'Set Reminder'}
                </button>
                <button type="button" onClick={() => setReminderTarget(null)}
                  style={{ padding: '10px 14px', borderRadius: 10, background: 'transparent', border: '1px solid rgba(255,255,255,0.10)', color: '#7A8B9E', fontSize: '0.80rem', cursor: 'pointer' }}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .crm-icon-btn {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.09);
          color: #7a8b9e;
          border-radius: 8px;
          padding: 6px;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 30px;
          min-height: 30px;
          transition: all 0.13s;
        }
        .crm-icon-btn:hover {
          background: rgba(0,196,188,0.12);
          color: #00c4bc;
          border-color: rgba(0,196,188,0.36);
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        @media print {
          .crm-shell button, .crm-shell input, .crm-shell [role='tablist'] { display: none !important; }
        }
        @media (max-width: 640px) {
          .crm-row-head { display: none !important; }
          .crm-row {
            grid-template-columns: 1fr auto !important;
            row-gap: 6px;
          }
          .crm-row > *:nth-child(2),
          .crm-row > *:nth-child(3),
          .crm-row > *:nth-child(4) { display: none; }
        }
      `}</style>
    </div>
  );
}
