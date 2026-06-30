'use client';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

type StatusFilter = 'open' | 'resolved' | 'dismissed' | 'all';
type TopTab = 'reports' | 'mentions';
type MentionStatusFilter = 'unread' | 'read' | 'resolved' | 'all';

interface ReportRow {
  id: string;
  reporter_id: string | null;
  message_id: string;
  conversation_id: string;
  reason: string;
  note: string | null;
  status: 'open' | 'resolved' | 'dismissed';
  resolved_by: string | null;
  resolved_at: string | null;
  resolution_note: string | null;
  created_at: string;
  reporter: { id: string; full_name: string | null; username: string | null } | null;
  message:
    | {
        id: string;
        text: string | null;
        message_type: string;
        sender_id: string | null;
        created_at: string;
        is_deleted: boolean;
        delete_scope: string | null;
        sender: { id: string; full_name: string | null; username: string | null } | null;
      }
    | null;
  conversation: { id: string; type: string; title: string | null } | null;
}

interface MentionRow {
  id: string;
  message_id: string;
  conversation_id: string;
  sender_id: string | null;
  message_text: string | null;
  status: 'unread' | 'read' | 'resolved';
  resolved_by: string | null;
  resolved_at: string | null;
  resolution_note: string | null;
  created_at: string;
  sender: { id: string; full_name: string | null; username: string | null } | null;
  message:
    | {
        id: string;
        text: string | null;
        message_type: string;
        created_at: string;
        is_deleted: boolean;
        delete_scope: string | null;
      }
    | null;
  conversation: { id: string; type: string; title: string | null } | null;
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

function prettyReason(r: string): string {
  switch (r) {
    case 'spam':
      return 'Spam';
    case 'harassment':
      return 'Harassment';
    case 'inappropriate':
      return 'Inappropriate';
    case 'scam':
      return 'Scam';
    case 'other':
      return 'Other';
    default:
      return r;
  }
}

function prettyStatus(s: ReportRow['status']): string {
  switch (s) {
    case 'open':
      return 'Open';
    case 'resolved':
      return 'Resolved';
    case 'dismissed':
      return 'Dismissed';
    default:
      return s;
  }
}

function prettyMentionStatus(s: MentionRow['status']): string {
  switch (s) {
    case 'unread':
      return 'Unread';
    case 'read':
      return 'Read';
    case 'resolved':
      return 'Resolved';
    default:
      return s;
  }
}

function statusColor(s: ReportRow['status']): string {
  if (s === 'open') return 'var(--red, #E53E3E)';
  if (s === 'resolved') return 'var(--teal, #00C4BC)';
  return 'var(--grey-400, #A8B4C0)';
}

function mentionStatusColor(s: MentionRow['status']): string {
  if (s === 'unread') return 'var(--red, #E53E3E)';
  if (s === 'resolved') return 'var(--teal, #00C4BC)';
  return 'var(--grey-400, #A8B4C0)';
}

export default function AdminMessengerClient() {
  const [topTab, setTopTab] = useState<TopTab>('reports');
  const [status, setStatus] = useState<StatusFilter>('open');
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [reportNextBefore, setReportNextBefore] = useState<string | null>(null);
  const [reportsLoadingMore, setReportsLoadingMore] = useState(false);

  // Phase 13: admin mentions tab
  const [mentionStatus, setMentionStatus] = useState<MentionStatusFilter>('unread');
  const [mentions, setMentions] = useState<MentionRow[]>([]);
  const [mentionsLoading, setMentionsLoading] = useState(false);
  const [mentionBusy, setMentionBusy] = useState<Record<string, boolean>>({});

  const load = useCallback(async (filter: StatusFilter) => {
    setLoading(true);
    setReportNextBefore(null);
    try {
      const body: Record<string, unknown> = filter === 'all' ? {} : { status: filter };
      const res = await fetch('/api/admin/messenger/list-reports', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        toast('Could Not Load Reports');
        return;
      }
      const json = (await res.json()) as { reports?: ReportRow[]; nextBefore?: string | null };
      setRows(json.reports ?? []);
      setReportNextBefore(json.nextBefore ?? null);
    } catch {
      toast('Network Error');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadMoreReports = useCallback(async () => {
    if (!reportNextBefore || reportsLoadingMore) return;
    setReportsLoadingMore(true);
    try {
      const body: Record<string, unknown> = status === 'all' ? {} : { status };
      body.before = reportNextBefore;
      const res = await fetch('/api/admin/messenger/list-reports', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        toast('Could Not Load More Reports');
        return;
      }
      const json = (await res.json()) as { reports?: ReportRow[]; nextBefore?: string | null };
      setRows((cur) => [...cur, ...(json.reports ?? [])]);
      setReportNextBefore(json.nextBefore ?? null);
    } catch {
      toast('Network Error');
    } finally {
      setReportsLoadingMore(false);
    }
  }, [reportNextBefore, reportsLoadingMore, status]);

  const loadMentions = useCallback(async (filter: MentionStatusFilter) => {
    setMentionsLoading(true);
    try {
      const body = filter === 'all' ? {} : { status: filter };
      const res = await fetch('/api/admin/messenger/list-admin-mentions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        toast('Could Not Load Mentions');
        return;
      }
      const json = (await res.json()) as { mentions?: MentionRow[] };
      setMentions(json.mentions ?? []);
    } catch {
      toast('Network Error');
    } finally {
      setMentionsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (topTab === 'reports') void load(status);
  }, [status, load, topTab]);

  useEffect(() => {
    if (topTab === 'mentions') void loadMentions(mentionStatus);
  }, [mentionStatus, loadMentions, topTab]);

  const handleResolve = useCallback(async (row: ReportRow, nextStatus: 'resolved' | 'dismissed') => {
    setBusy((cur) => ({ ...cur, [row.id]: true }));
    try {
      const res = await fetch('/api/admin/messenger/resolve-report', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ reportId: row.id, status: nextStatus }),
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        toast(json.error ?? 'Could Not Update Report');
        return;
      }
      // Optimistically remove from view if no longer matches filter.
      if (status === 'all') {
        setRows((cur) =>
          cur.map((r) => (r.id === row.id ? { ...r, status: nextStatus } : r)),
        );
      } else {
        setRows((cur) => cur.filter((r) => r.id !== row.id));
      }
      toast(nextStatus === 'resolved' ? 'Report Resolved' : 'Report Dismissed');
    } catch {
      toast('Network Error');
    } finally {
      setBusy((cur) => {
        const next = { ...cur };
        delete next[row.id];
        return next;
      });
    }
  }, [status]);

  const handleDelete = useCallback(async (row: ReportRow) => {
    if (!row.message) return;
    if (!window.confirm('Delete This Message For Everyone?')) return;
    setBusy((cur) => ({ ...cur, [row.id]: true }));
    try {
      const res = await fetch('/api/admin/messenger/delete-message', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ messageId: row.message.id, reportId: row.id }),
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        toast(json.error ?? 'Could Not Delete Message');
        return;
      }
      // Reflect both message deletion and report auto-resolution.
      setRows((cur) =>
        cur
          .map((r) =>
            r.id === row.id
              ? {
                  ...r,
                  status: 'resolved' as const,
                  message: r.message
                    ? { ...r.message, is_deleted: true, delete_scope: 'for_everyone', text: null }
                    : r.message,
                }
              : r,
          )
          .filter((r) => (status === 'all' || status === 'resolved') ? true : r.id !== row.id),
      );
      toast('Message Deleted For Everyone');
    } catch {
      toast('Network Error');
    } finally {
      setBusy((cur) => {
        const next = { ...cur };
        delete next[row.id];
        return next;
      });
    }
  }, [status]);

  // Audit5 fix: previously this client had Mark Read / Mark Resolved buttons
  // stubbed out because no resolve route existed. The route now lives at
  // /api/admin/messenger/resolve-mention and is wired here.
  const handleMentionResolve = useCallback(async (
    row: MentionRow,
    nextStatus: 'read' | 'resolved',
  ) => {
    setMentionBusy((cur) => ({ ...cur, [row.id]: true }));
    try {
      const res = await fetch('/api/admin/messenger/resolve-mention', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ mentionId: row.id, status: nextStatus }),
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        toast(json.error ?? 'Could Not Update Mention');
        return;
      }
      // Drop the row from view if it no longer matches the active filter,
      // otherwise update the status in place.
      if (mentionStatus === 'all' || mentionStatus === nextStatus) {
        setMentions((cur) =>
          cur.map((m) => (m.id === row.id ? { ...m, status: nextStatus } : m)),
        );
      } else {
        setMentions((cur) => cur.filter((m) => m.id !== row.id));
      }
      toast(nextStatus === 'resolved' ? 'Mention Resolved' : 'Mention Marked Read');
    } catch {
      toast('Network Error');
    } finally {
      setMentionBusy((cur) => {
        const next = { ...cur };
        delete next[row.id];
        return next;
      });
    }
  }, [mentionStatus]);

  const handleMentionDelete = useCallback(async (row: MentionRow) => {
    if (!row.message) return;
    if (!window.confirm('Delete This Message For Everyone?')) return;
    setMentionBusy((cur) => ({ ...cur, [row.id]: true }));
    try {
      const res = await fetch('/api/admin/messenger/delete-message', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ messageId: row.message.id }),
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        toast(json.error ?? 'Could Not Delete Message');
        return;
      }
      setMentions((cur) =>
        cur.map((m) =>
          m.id === row.id && m.message
            ? { ...m, message: { ...m.message, is_deleted: true, delete_scope: 'for_everyone', text: null } }
            : m,
        ),
      );
      toast('Message Deleted For Everyone');
    } catch {
      toast('Network Error');
    } finally {
      setMentionBusy((cur) => {
        const next = { ...cur };
        delete next[row.id];
        return next;
      });
    }
  }, []);

  const toggleExpand = (id: string) => {
    setExpanded((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div style={{ padding: 'var(--space-8, 24px)' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 'var(--space-6, 16px)',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <h1 style={{ margin: 0, fontSize: '1.6rem', color: 'var(--white, #FFFFFF)' }}>Admin Moderation</h1>
        <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--grey-400, #A8B4C0)' }}>Messenger Reports And Mentions</p>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {(['reports', 'mentions'] as TopTab[]).map((t) => {
          const label = t === 'reports' ? 'Reports' : '@admin Mentions';
          const active = t === topTab;
          return (
            <button
              key={t}
              type="button"
              onClick={() => setTopTab(t)}
              style={{
                padding: '8px 14px',
                borderRadius: 8,
                border: '1px solid var(--surface-3, #1D2D3E)',
                background: active ? 'var(--teal, #00C4BC)' : 'transparent',
                color: active ? '#000' : 'var(--white, #FFFFFF)',
                cursor: 'pointer',
                fontWeight: 700,
                fontSize: '0.88rem',
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {topTab === 'reports' && (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            {(['open', 'resolved', 'dismissed', 'all'] as StatusFilter[]).map((s) => {
              const label =
                s === 'open'
                  ? 'Open Reports'
                  : s === 'resolved'
                  ? 'Resolved'
                  : s === 'dismissed'
                  ? 'Dismissed'
                  : 'All';
              const active = s === status;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatus(s)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 8,
                    border: '1px solid var(--surface-3, #1D2D3E)',
                    background: active ? 'var(--teal, #00C4BC)' : 'transparent',
                    color: active ? '#000' : 'var(--white, #FFFFFF)',
                    cursor: 'pointer',
                    fontWeight: 700,
                    fontSize: '0.84rem',
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {loading ? (
            <div style={{ color: 'var(--grey-400, #A8B4C0)', padding: 16 }}>Loading Reports</div>
          ) : rows.length === 0 ? (
            <div style={{ color: 'var(--grey-400, #A8B4C0)', padding: 16 }}>No Reports</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {rows.map((row) => {
                const reporterName =
                  row.reporter?.full_name?.trim() || row.reporter?.username || 'Unknown Reporter';
                const senderName =
                  row.message?.sender?.full_name?.trim() ||
                  row.message?.sender?.username ||
                  'Unknown Sender';
                const isExpanded = expanded.has(row.id);
                const msgDeleted = Boolean(row.message?.is_deleted);
                const isBusy = Boolean(busy[row.id]);

                return (
                  <div
                    key={row.id}
                    style={{
                      padding: 14,
                      borderRadius: 10,
                      background: 'var(--surface-2, #162230)',
                      border: '1px solid var(--surface-3, #1D2D3E)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                        <div style={{ color: 'var(--white, #FFFFFF)', fontWeight: 700, fontSize: '0.94rem' }}>
                          {prettyReason(row.reason)} Report
                        </div>
                        <div style={{ color: 'var(--grey-400, #A8B4C0)', fontSize: '0.78rem' }}>
                          Reporter: {reporterName} - {formatDateTime(row.created_at)}
                        </div>
                        {row.note && (
                          <div style={{ color: 'var(--grey-400, #A8B4C0)', fontSize: '0.82rem', marginTop: 4 }}>
                            Note: {row.note}
                          </div>
                        )}
                      </div>
                      <div
                        style={{
                          padding: '4px 10px',
                          borderRadius: 999,
                          border: `1px solid ${statusColor(row.status)}`,
                          color: statusColor(row.status),
                          fontWeight: 700,
                          fontSize: '0.74rem',
                          whiteSpace: 'nowrap',
                          height: 24,
                        }}
                      >
                        {prettyStatus(row.status)}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => toggleExpand(row.id)}
                      style={{
                        alignSelf: 'flex-start',
                        padding: '4px 8px',
                        borderRadius: 6,
                        border: '1px solid var(--surface-3, #1D2D3E)',
                        background: 'transparent',
                        color: 'var(--teal, #00C4BC)',
                        cursor: 'pointer',
                        fontWeight: 700,
                        fontSize: '0.78rem',
                      }}
                    >
                      {isExpanded ? 'Hide Message Preview' : 'Show Message Preview'}
                    </button>

                    {isExpanded && (
                      <div
                        style={{
                          padding: 10,
                          background: 'var(--surface-1, #0F1923)',
                          border: '1px solid var(--surface-3, #1D2D3E)',
                          borderRadius: 8,
                          color: 'var(--white, #FFFFFF)',
                          fontSize: '0.84rem',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 4,
                        }}
                      >
                        <div style={{ color: 'var(--grey-400, #A8B4C0)', fontSize: '0.74rem' }}>
                          Sender: {senderName} -{' '}
                          {row.message?.created_at ? formatDateTime(row.message.created_at) : ''}
                        </div>
                        <div style={{ color: 'var(--grey-400, #A8B4C0)', fontSize: '0.74rem' }}>
                          Conversation: {row.conversation?.title?.trim() || row.conversation?.type || 'Unknown'}
                        </div>
                        <div style={{ wordBreak: 'break-word', whiteSpace: 'pre-wrap' }}>
                          {msgDeleted ? (
                            <em style={{ color: 'var(--grey-400, #A8B4C0)' }}>Message Deleted</em>
                          ) : (
                            row.message?.text || <em style={{ color: 'var(--grey-400, #A8B4C0)' }}>No Text Body</em>
                          )}
                        </div>
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                      {row.status === 'open' && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleResolve(row, 'dismissed')}
                            disabled={isBusy}
                            style={btnSecondary(isBusy)}
                          >
                            Dismiss
                          </button>
                          <button
                            type="button"
                            onClick={() => handleResolve(row, 'resolved')}
                            disabled={isBusy}
                            style={btnPrimary(isBusy)}
                          >
                            Resolve
                          </button>
                          {!msgDeleted && row.message && (
                            <button
                              type="button"
                              onClick={() => handleDelete(row)}
                              disabled={isBusy}
                              style={btnDanger(isBusy)}
                            >
                              Delete For Everyone
                            </button>
                          )}
                        </>
                      )}
                      {row.status !== 'open' && row.resolved_at && (
                        <div style={{ color: 'var(--grey-400, #A8B4C0)', fontSize: '0.78rem', alignSelf: 'center' }}>
                          {prettyStatus(row.status)} {formatDateTime(row.resolved_at)}
                          {row.resolution_note ? ` - ${row.resolution_note}` : ''}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {reportNextBefore && (
            <div style={{ marginTop: 12, textAlign: 'center' }}>
              <button
                type="button"
                onClick={loadMoreReports}
                disabled={reportsLoadingMore}
                style={{
                  padding: '8px 20px',
                  borderRadius: 8,
                  border: '1px solid var(--surface-3, #1D2D3E)',
                  background: 'transparent',
                  color: 'var(--teal, #00C4BC)',
                  cursor: reportsLoadingMore ? 'wait' : 'pointer',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                }}
              >
                {reportsLoadingMore ? 'Loading...' : 'Load More Reports'}
              </button>
            </div>
          )}
        </>
      )}

      {topTab === 'mentions' && (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            {(['unread', 'read', 'resolved', 'all'] as MentionStatusFilter[]).map((s) => {
              const label =
                s === 'unread'
                  ? 'Unread'
                  : s === 'read'
                  ? 'Read'
                  : s === 'resolved'
                  ? 'Resolved'
                  : 'All';
              const active = s === mentionStatus;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setMentionStatus(s)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 8,
                    border: '1px solid var(--surface-3, #1D2D3E)',
                    background: active ? 'var(--teal, #00C4BC)' : 'transparent',
                    color: active ? '#000' : 'var(--white, #FFFFFF)',
                    cursor: 'pointer',
                    fontWeight: 700,
                    fontSize: '0.84rem',
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {mentionsLoading ? (
            <div style={{ color: 'var(--grey-400, #A8B4C0)', padding: 16 }}>Loading Mentions</div>
          ) : mentions.length === 0 ? (
            <div style={{ color: 'var(--grey-400, #A8B4C0)', padding: 16 }}>No @admin Mentions</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {mentions.map((row) => {
                const senderName =
                  row.sender?.full_name?.trim() || row.sender?.username || 'Unknown Sender';
                const msgDeleted = Boolean(row.message?.is_deleted);
                const isBusy = Boolean(mentionBusy[row.id]);
                const snippet = row.message_text ?? '';
                return (
                  <div
                    key={row.id}
                    style={{
                      padding: 14,
                      borderRadius: 10,
                      background: 'var(--surface-2, #162230)',
                      border: '1px solid var(--surface-3, #1D2D3E)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                        <div style={{ color: 'var(--white, #FFFFFF)', fontWeight: 700, fontSize: '0.94rem' }}>
                          @admin Mention
                        </div>
                        <div style={{ color: 'var(--grey-400, #A8B4C0)', fontSize: '0.78rem' }}>
                          Sender: {senderName} - {formatDateTime(row.created_at)}
                        </div>
                        <div style={{ color: 'var(--grey-400, #A8B4C0)', fontSize: '0.78rem' }}>
                          Conversation: {row.conversation?.title?.trim() || row.conversation?.type || 'Unknown'}
                        </div>
                      </div>
                      <div
                        style={{
                          padding: '4px 10px',
                          borderRadius: 999,
                          border: `1px solid ${mentionStatusColor(row.status)}`,
                          color: mentionStatusColor(row.status),
                          fontWeight: 700,
                          fontSize: '0.74rem',
                          whiteSpace: 'nowrap',
                          height: 24,
                        }}
                      >
                        {prettyMentionStatus(row.status)}
                      </div>
                    </div>

                    <div
                      style={{
                        padding: 10,
                        background: 'var(--surface-1, #0F1923)',
                        border: '1px solid var(--surface-3, #1D2D3E)',
                        borderRadius: 8,
                        color: 'var(--white, #FFFFFF)',
                        fontSize: '0.84rem',
                        wordBreak: 'break-word',
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      {msgDeleted ? (
                        <em style={{ color: 'var(--grey-400, #A8B4C0)' }}>Message Deleted</em>
                      ) : (
                        snippet || <em style={{ color: 'var(--grey-400, #A8B4C0)' }}>No Text Body</em>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                      {row.status === 'unread' && (
                        <button
                          type="button"
                          onClick={() => handleMentionResolve(row, 'read')}
                          disabled={isBusy}
                          style={btnSecondary(isBusy)}
                        >
                          Mark Read
                        </button>
                      )}
                      {row.status !== 'resolved' && (
                        <button
                          type="button"
                          onClick={() => handleMentionResolve(row, 'resolved')}
                          disabled={isBusy}
                          style={btnPrimary(isBusy)}
                        >
                          Mark Resolved
                        </button>
                      )}
                      {!msgDeleted && row.message && (
                        <button
                          type="button"
                          onClick={() => handleMentionDelete(row)}
                          disabled={isBusy}
                          style={btnDanger(isBusy)}
                        >
                          Delete For Everyone
                        </button>
                      )}
                      {row.status === 'resolved' && row.resolved_at && (
                        <div style={{ color: 'var(--grey-400, #A8B4C0)', fontSize: '0.78rem', alignSelf: 'center' }}>
                          Resolved {formatDateTime(row.resolved_at)}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function btnPrimary(disabled: boolean): React.CSSProperties {
  return {
    padding: '6px 12px',
    borderRadius: 8,
    border: 0,
    background: disabled ? 'var(--surface-3, #1D2D3E)' : 'var(--teal, #00C4BC)',
    color: disabled ? 'var(--grey-400, #A8B4C0)' : '#000',
    cursor: disabled ? 'wait' : 'pointer',
    fontWeight: 700,
    fontSize: '0.84rem',
  };
}

function btnSecondary(disabled: boolean): React.CSSProperties {
  return {
    padding: '6px 12px',
    borderRadius: 8,
    border: '1px solid var(--surface-3, #1D2D3E)',
    background: 'transparent',
    color: 'var(--white, #FFFFFF)',
    cursor: disabled ? 'wait' : 'pointer',
    fontWeight: 600,
    fontSize: '0.84rem',
  };
}

function btnDanger(disabled: boolean): React.CSSProperties {
  return {
    padding: '6px 12px',
    borderRadius: 8,
    border: '1px solid var(--red, #E53E3E)',
    background: 'transparent',
    color: 'var(--red, #E53E3E)',
    cursor: disabled ? 'wait' : 'pointer',
    fontWeight: 700,
    fontSize: '0.84rem',
  };
}
