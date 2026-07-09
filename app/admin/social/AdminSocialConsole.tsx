'use client';

import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import {
  RefreshCw, Link2, CheckCircle2, AlertTriangle, Clock, Send,
  Trash2, RotateCcw, ShieldCheck, Power, ExternalLink,
} from 'lucide-react';

/* ---------------------------------------------------------------------- */

type Provider = 'pinterest' | 'google' | 'x' | 'meta' | 'tiktok';
type PostStatus = 'pending' | 'posting' | 'posted' | 'failed' | 'blocked';

interface Account {
  provider: Provider;
  label: string;
  connected: boolean;
  displayLabel: string | null;
  connectedAt: string | null;
  expiresAt: string | null;
  expired: boolean;
  canRefresh: boolean;
  scope: string | null;
  accountRef: Record<string, string>;
}

export interface QueuePost {
  id: string;
  platform: string;
  media_url: string | null;
  media_type: string;
  caption: string;
  link: string | null;
  scheduled_for: string;
  status: PostStatus;
  attempts: number;
  compliance_notes: string | null;
  posted_at: string | null;
  platform_url: string | null;
  error: string | null;
  source: string | null;
}

const STATUS_STYLES: Record<PostStatus, { fg: string; bg: string; border: string }> = {
  pending: { fg: '#5EEAD4', bg: 'rgba(94,234,212,0.12)',  border: 'rgba(94,234,212,0.42)' },
  posting: { fg: '#2DD4BF', bg: 'rgba(45,212,191,0.12)',  border: 'rgba(45,212,191,0.45)' },
  posted:  { fg: '#00C4BC', bg: 'rgba(0,196,188,0.12)',   border: 'rgba(0,196,188,0.45)' },
  blocked: { fg: '#D0DAE4', bg: 'rgba(208,218,228,0.12)', border: 'rgba(208,218,228,0.45)' },
  failed:  { fg: '#F87171', bg: 'rgba(248,113,113,0.14)', border: 'rgba(248,113,113,0.50)' },
};

const FILTERS: (PostStatus | 'all')[] = ['all', 'pending', 'posted', 'failed', 'blocked'];

function fmtDate(iso: string | null): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

/* ---------------------------------------------------------------------- */

export default function AdminSocialConsole({
  initialEnabled, initialAccounts, initialCounts, initialPosts,
}: {
  initialEnabled: boolean;
  initialAccounts: Account[];
  initialCounts: Record<string, number>;
  initialPosts: QueuePost[];
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [accounts, setAccounts] = useState<Account[]>(initialAccounts);
  const [counts, setCounts] = useState<Record<string, number>>(initialCounts);
  const [posts, setPosts] = useState<QueuePost[]>(initialPosts);
  const [filter, setFilter] = useState<PostStatus | 'all'>('all');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  /** Re-fetch status + queue. Called only from event handlers, never an effect. */
  const load = useCallback(async (status: PostStatus | 'all') => {
    setLoading(true);
    try {
      const qs = status === 'all' ? '' : `?status=${status}`;
      const [sRes, qRes] = await Promise.all([
        fetch('/api/admin/social/status', { cache: 'no-store' }),
        fetch(`/api/admin/social/queue${qs}`, { cache: 'no-store' }),
      ]);
      if (!sRes.ok) throw new Error(`Status HTTP ${sRes.status}`);
      if (!qRes.ok) throw new Error(`Queue HTTP ${qRes.status}`);
      const [sJson, qJson] = await Promise.all([sRes.json(), qRes.json()]);

      setEnabled(Boolean(sJson.enabled));
      setAccounts(sJson.accounts ?? []);
      setCounts(sJson.counts ?? {});
      setPosts(qJson.posts ?? []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could Not Load');
    } finally {
      setLoading(false);
    }
  }, []);

  const changeFilter = useCallback((f: PostStatus | 'all') => {
    setFilter(f);
    void load(f);
  }, [load]);

  const act = useCallback(async (id: string, action: 'retry' | 'delete') => {
    setBusyId(id);
    try {
      const r = await fetch('/api/admin/social/retry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { toast.error(j.error ?? 'Action Failed'); return; }
      toast.success(action === 'retry' ? 'Post Re-Queued' : 'Post Removed');
      await load(filter);
    } finally {
      setBusyId(null);
    }
  }, [filter, load]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '4px 0 40px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#FFFFFF', margin: 0 }}>Social Autoposter</h1>
          <p style={{ fontSize: '0.8rem', color: '#7A8B9E', margin: '4px 0 0' }}>
            Connect Your Accounts, Watch The Publish Queue, And Retry Anything That Failed.
          </p>
        </div>
        <button type="button" onClick={() => void load(filter)} disabled={loading}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.10)', color: '#B0B8C4', fontSize: '0.75rem', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer' }}>
          <RefreshCw size={13} /> {loading ? 'Refreshing' : 'Refresh'}
        </button>
      </div>

      {/* Kill-switch state */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
        padding: '12px 16px', borderRadius: 12,
        background: enabled ? 'rgba(0,196,188,0.06)' : 'rgba(208,218,228,0.05)',
        border: `1px solid ${enabled ? 'rgba(0,196,188,0.28)' : 'rgba(208,218,228,0.20)'}`,
        borderLeft: `3px solid ${enabled ? '#00C4BC' : '#A8B4C0'}`,
      }}>
        <Power size={15} color={enabled ? '#00C4BC' : '#A8B4C0'} aria-hidden />
        <span style={{ fontSize: '0.82rem', fontWeight: 700, color: '#FFFFFF' }}>
          Autoposting Is {enabled ? 'Enabled' : 'Disabled'}
        </span>
        <span style={{ fontSize: '0.75rem', color: '#7A8B9E' }}>
          {enabled
            ? '- The Hourly Cron Will Publish Due Posts.'
            : '- Set SOCIAL_AUTOPOST_ENABLED To True In Vercel To Start Publishing. Nothing Posts Until Then.'}
        </span>
      </div>

      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderRadius: 12, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.20)', color: '#EF4444', fontSize: '0.8rem' }}>
          <AlertTriangle size={14} /> {error}
        </div>
      )}

      {/* Connected accounts */}
      <section>
        <h2 style={{ fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#5A6A7A', margin: '4px 0 10px' }}>Connected Accounts</h2>
        <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
          {accounts.map(a => (
            <div key={a.provider} style={{ padding: '14px 16px', borderRadius: 14, background: 'linear-gradient(160deg, rgba(24,34,52,0.98) 0%, rgba(14,20,34,0.98) 100%)', border: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '0.86rem', fontWeight: 800, color: '#FFFFFF' }}>{a.label}</div>
                  {a.displayLabel && <div style={{ fontSize: '0.72rem', color: '#7A8B9E', marginTop: 2 }}>{a.displayLabel}</div>}
                </div>
                {a.connected
                  ? <CheckCircle2 size={16} color={a.expired && !a.canRefresh ? '#F87171' : '#00C4BC'} aria-hidden />
                  : <Clock size={16} color="#7A8B9E" aria-hidden />}
              </div>

              <div style={{ fontSize: '0.72rem', color: '#7A8B9E', lineHeight: 1.5 }}>
                {a.connected ? (
                  <>
                    <div>Connected {fmtDate(a.connectedAt)}</div>
                    <div>
                      Token{' '}
                      {a.expired
                        ? (a.canRefresh
                          ? <span style={{ color: '#5EEAD4' }}>Expired - Auto-Refreshes</span>
                          : <span style={{ color: '#F87171' }}>Expired - Reconnect Needed</span>)
                        : <span style={{ color: '#00C4BC' }}>Valid</span>}
                    </div>
                    {Object.entries(a.accountRef).map(([kk, vv]) => (
                      <div key={kk} style={{ color: '#5A6A7A' }}>{kk}: {vv}</div>
                    ))}
                  </>
                ) : (
                  <div>Not Connected Yet.</div>
                )}
              </div>

              <a href={`/api/social/oauth/${a.provider}/start`}
                style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '8px 12px', borderRadius: 9, textDecoration: 'none', background: a.connected ? 'rgba(255,255,255,0.05)' : 'rgba(0,196,188,0.14)', border: `1px solid ${a.connected ? 'rgba(255,255,255,0.12)' : 'rgba(0,196,188,0.34)'}`, color: a.connected ? '#B0B8C4' : '#00C4BC', fontSize: '0.74rem', fontWeight: 700 }}>
                <Link2 size={12} /> {a.connected ? 'Reconnect' : 'Connect'}
              </a>
            </div>
          ))}
        </div>
      </section>

      {/* Queue */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', margin: '8px 0 10px' }}>
          <h2 style={{ fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#5A6A7A', margin: 0 }}>Publish Queue</h2>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {FILTERS.map(f => (
              <button key={f} type="button" onClick={() => changeFilter(f)}
                style={{ padding: '5px 12px', borderRadius: 999, fontSize: '0.71rem', fontWeight: 700, textTransform: 'capitalize', cursor: 'pointer', background: filter === f ? 'rgba(0,196,188,0.14)' : 'transparent', border: `1px solid ${filter === f ? 'rgba(0,196,188,0.40)' : 'rgba(255,255,255,0.10)'}`, color: filter === f ? '#00C4BC' : '#7A8B9E' }}>
                {f}{f !== 'all' && counts[f] != null ? ` (${counts[f]})` : ''}
              </button>
            ))}
          </div>
        </div>

        <div style={{ borderRadius: 16, overflow: 'hidden', background: 'linear-gradient(160deg, rgba(16,24,40,0.97) 0%, rgba(10,16,28,0.97) 100%)', border: '1px solid rgba(255,255,255,0.07)' }}>
          {posts.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: '#5A6A7A', fontSize: '0.83rem' }}>
              <Send size={20} style={{ marginBottom: 8, opacity: 0.5 }} aria-hidden />
              <div>No Posts In The Queue{filter !== 'all' ? ` With Status "${filter}"` : ''}.</div>
              <div style={{ fontSize: '0.75rem', marginTop: 6 }}>The Generator Pipeline Or The Enqueue Endpoint Fills This.</div>
            </div>
          ) : (
            posts.map(p => {
              const s = STATUS_STYLES[p.status] ?? STATUS_STYLES.pending;
              return (
                <div key={p.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '13px 16px', borderBottom: '1px solid rgba(255,255,255,0.045)', flexWrap: 'wrap' }}>
                  <span style={{ flexShrink: 0, fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.03em', textTransform: 'uppercase', color: s.fg, background: s.bg, border: `1px solid ${s.border}`, borderRadius: 999, padding: '3px 9px' }}>
                    {p.status}
                  </span>
                  <span style={{ flexShrink: 0, fontSize: '0.7rem', fontWeight: 700, color: '#B0B8C4', textTransform: 'capitalize', minWidth: 70 }}>{p.platform}</span>

                  <div style={{ flex: '1 1 320px', minWidth: 0 }}>
                    <div style={{ fontSize: '0.79rem', color: '#FFFFFF', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                      {p.caption}
                    </div>
                    <div style={{ fontSize: '0.68rem', color: '#5A6A7A', marginTop: 3, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      <span>Due {fmtDate(p.scheduled_for)}</span>
                      {p.media_type !== 'none' && <span>{p.media_type}</span>}
                      {p.attempts > 0 && <span>{p.attempts} Attempt{p.attempts !== 1 ? 's' : ''}</span>}
                      {p.source && <span>{p.source}</span>}
                    </div>
                    {p.status === 'blocked' && p.compliance_notes && (
                      <div style={{ fontSize: '0.7rem', color: '#D0DAE4', marginTop: 4, display: 'flex', alignItems: 'center', gap: 5 }}>
                        <ShieldCheck size={11} aria-hidden /> {p.compliance_notes}
                      </div>
                    )}
                    {p.status === 'failed' && p.error && (
                      <div style={{ fontSize: '0.7rem', color: '#F87171', marginTop: 4, wordBreak: 'break-word' }}>{p.error}</div>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    {p.platform_url && (
                      <a href={p.platform_url} target="_blank" rel="noopener noreferrer" title="View Post"
                        className="crm-icon-btn" style={{ textDecoration: 'none' }}>
                        <ExternalLink size={13} />
                      </a>
                    )}
                    {(p.status === 'failed' || p.status === 'blocked') && (
                      <button type="button" title="Retry" disabled={busyId === p.id}
                        onClick={() => void act(p.id, 'retry')} className="crm-icon-btn">
                        <RotateCcw size={13} />
                      </button>
                    )}
                    {p.status !== 'posted' && p.status !== 'posting' && (
                      <button type="button" title="Remove From Queue" disabled={busyId === p.id}
                        onClick={() => void act(p.id, 'delete')} className="crm-icon-btn">
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
