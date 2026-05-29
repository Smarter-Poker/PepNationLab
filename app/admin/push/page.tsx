import { redirect } from 'next/navigation';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

function formatTs(ts: string | null | undefined): string {
  if (!ts) return '';
  try {
    return new Date(ts).toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
  } catch {
    return String(ts);
  }
}

function maskUser(name: string | null | undefined, userId: string | null | undefined): string {
  if (name && name.trim() !== '') return name;
  if (userId) return userId.slice(0, 8) + '...';
  return 'Unknown User';
}

function bodyPreview(body: string | null | undefined): string {
  if (!body) return '';
  const trimmed = String(body).trim();
  return trimmed.length > 90 ? trimmed.slice(0, 90) + '...' : trimmed;
}

function statusBadge(status: string) {
  const colors: Record<string, { bg: string; fg: string }> = {
    sent: { bg: 'rgba(0,196,188,0.15)', fg: '#00C4BC' },
    pending: { bg: 'rgba(168,180,192,0.15)', fg: '#A8B4C0' },
    failed: { bg: 'rgba(229,62,62,0.15)', fg: '#E53E3E' },
    skipped: { bg: 'rgba(246,173,85,0.15)', fg: '#F6AD55' },
  };
  const c = colors[status] ?? colors.pending;
  return { background: c.bg, color: c.fg };
}

interface OutboxRow {
  id: string;
  created_at: string;
  recipient_user_id: string | null;
  title: string;
  body: string;
  event: string | null;
  status: string;
  attempts: number;
  failure_reason: string | null;
  sent_at: string | null;
}

export default async function AdminPushPage() {
  const supabase = await createServiceClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (profile?.role !== 'admin') {
    redirect('/dashboard');
  }

  const { data: rows } = await supabase
    .from('push_outbox')
    .select('id, created_at, recipient_user_id, title, body, event, status, attempts, failure_reason, sent_at')
    .order('created_at', { ascending: false })
    .limit(200);

  const outbox: OutboxRow[] = (rows ?? []) as OutboxRow[];

  const recipientIds = Array.from(
    new Set(outbox.map((r) => r.recipient_user_id).filter((x): x is string => !!x))
  );
  const recipientMap = new Map<string, string>();
  if (recipientIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', recipientIds);
    (profiles ?? []).forEach((p) => recipientMap.set(p.id, p.full_name ?? ''));
  }

  return (
    <div style={{ padding: 'var(--space-8)' }}>
      <header style={{ marginBottom: 'var(--space-6)' }}>
        <h1 style={{ fontSize: '1.6rem', marginBottom: 'var(--space-2)' }}>
          Push Log
        </h1>
        <p style={{ fontSize: '0.85rem', color: 'var(--grey-400)' }}>
          Last 200 Outbound Web Push Notifications. Read-Only Audit View.
        </p>
      </header>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.04)', textAlign: 'left' }}>
                <th style={{ padding: '0.75rem 1rem', color: 'var(--silver)', fontWeight: 600 }}>Created</th>
                <th style={{ padding: '0.75rem 1rem', color: 'var(--silver)', fontWeight: 600 }}>Recipient</th>
                <th style={{ padding: '0.75rem 1rem', color: 'var(--silver)', fontWeight: 600 }}>Event</th>
                <th style={{ padding: '0.75rem 1rem', color: 'var(--silver)', fontWeight: 600 }}>Status</th>
                <th style={{ padding: '0.75rem 1rem', color: 'var(--silver)', fontWeight: 600 }}>Title</th>
                <th style={{ padding: '0.75rem 1rem', color: 'var(--silver)', fontWeight: 600 }}>Body Preview</th>
                <th style={{ padding: '0.75rem 1rem', color: 'var(--silver)', fontWeight: 600 }}>Attempts</th>
              </tr>
            </thead>
            <tbody>
              {outbox.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--grey-400)' }}>
                    No Push Notifications Have Been Queued Yet.
                  </td>
                </tr>
              )}
              {outbox.map((row) => {
                const recipientName = row.recipient_user_id ? recipientMap.get(row.recipient_user_id) ?? '' : '';
                return (
                  <tr key={row.id} style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '0.65rem 1rem', color: 'var(--grey-300)', whiteSpace: 'nowrap' }}>
                      {formatTs(row.created_at)}
                    </td>
                    <td style={{ padding: '0.65rem 1rem', color: '#FFFFFF' }}>
                      {maskUser(recipientName, row.recipient_user_id)}
                    </td>
                    <td style={{ padding: '0.65rem 1rem', color: 'var(--grey-300)' }}>
                      {row.event ?? '-'}
                    </td>
                    <td style={{ padding: '0.65rem 1rem' }}>
                      <span style={{
                        padding: '2px 8px', borderRadius: 999, fontSize: '0.7rem',
                        fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em',
                        ...statusBadge(row.status),
                      }}>
                        {row.status}
                      </span>
                      {row.failure_reason && (
                        <div style={{ marginTop: 4, fontSize: '0.66rem', color: '#E53E3E' }}>
                          {row.failure_reason}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '0.65rem 1rem', color: '#FFFFFF' }}>
                      {row.title}
                    </td>
                    <td style={{ padding: '0.65rem 1rem', color: 'var(--grey-300)' }}>
                      {bodyPreview(row.body)}
                    </td>
                    <td style={{ padding: '0.65rem 1rem', color: 'var(--grey-400)' }}>
                      {row.attempts}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
