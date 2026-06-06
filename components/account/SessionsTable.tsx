'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

interface SessionRow {
  id: string;
  device_name: string | null;
  user_agent: string | null;
  ip: string | null;
  last_seen: string;
  created_at: string;
  revoked_at: string | null;
}

function formatDate(iso: string | null): string {
  if (!iso) return '-';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function shortAgent(ua: string | null): string {
  if (!ua) return 'Unknown Device';
  if (/iPhone/i.test(ua)) return 'iPhone';
  if (/iPad/i.test(ua)) return 'iPad';
  if (/Android/i.test(ua)) return 'Android';
  if (/Mac OS X/i.test(ua)) return 'Mac';
  if (/Windows/i.test(ua)) return 'Windows';
  if (/Linux/i.test(ua)) return 'Linux';
  return 'Browser';
}

export default function SessionsTable() {
  const [rows, setRows] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [revokingAll, setRevokingAll] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/agent/sessions');
      const json = await res.json();
      if (res.ok && Array.isArray(json.sessions)) {
        setRows(json.sessions);
      } else {
        setRows([]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const revoke = useCallback(
    async (id: string) => {
      setBusyId(id);
      try {
        const res = await fetch(`/api/agent/sessions/${id}`, { method: 'DELETE' });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Failed To Revoke Session.');
        toast.success('Session Revoked.');
        await load();
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed To Revoke Session.';
        toast.error(msg);
      } finally {
        setBusyId(null);
      }
    },
    [load],
  );

  const revokeAllOthers = useCallback(async () => {
    setRevokingAll(true);
    try {
      const res = await fetch('/api/agent/sessions', { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed To Revoke Sessions.');
      toast.success(`Revoked ${json.revoked ?? 0} Other Session(s).`);
      await load();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed To Revoke Sessions.';
      toast.error(msg);
    } finally {
      setRevokingAll(false);
    }
  }, [load]);

  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 'var(--space-3)',
          gap: 'var(--space-2)',
        }}
      >
        <h4 style={{ margin: 0, color: 'var(--teal)' }}>Active Sessions</h4>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={revokingAll || rows.length <= 1}
          onClick={revokeAllOthers}
        >
          {revokingAll ? 'Revoking...' : 'Revoke All Others'}
        </button>
      </div>

      {loading ? (
        <p style={{ color: 'var(--silver)', fontSize: '0.85rem' }}>Loading Sessions...</p>
      ) : rows.length === 0 ? (
        <p style={{ color: 'var(--silver)', fontSize: '0.85rem' }}>
          No Active Sessions Tracked Yet. Your Current Browser Will Appear Here After The Next Sign-In.
        </p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          {rows.map((row) => (
            <li
              key={row.id}
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                gap: 'var(--space-3)',
                padding: 'var(--space-3)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(255,255,255,0.02)',
              }}
            >
              <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                <div style={{ color: 'var(--white)', fontWeight: 600, fontSize: '0.9rem' }}>
                  {row.device_name || shortAgent(row.user_agent)}
                </div>
                <div style={{ color: 'var(--silver)', fontSize: '0.75rem', marginTop: 2 }}>
                  Last Seen {formatDate(row.last_seen)}
                </div>
                {row.ip && (
                  <div style={{ color: 'var(--silver)', fontSize: '0.7rem', fontFamily: 'monospace', marginTop: 2 }}>
                    IP {row.ip}
                  </div>
                )}
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={busyId === row.id}
                onClick={() => revoke(row.id)}
              >
                {busyId === row.id ? 'Revoking...' : 'Revoke'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
