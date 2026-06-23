'use client';
import { useCallback, useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import Avatar from './Avatar';

interface BlockRow {
  id: string;
  blocked_id: string;
  full_name: string | null;
  username: string | null;
  reason: string | null;
  created_at: string;
}

interface Props {
  onClose: () => void;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

export default function BlockList({ onClose }: Props) {
  const [rows, setRows] = useState<BlockRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<Record<string, boolean>>({});

  // Audit2 fix: Escape key closes the modal.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/messenger/list-blocks', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: '{}',
        });
        if (!res.ok) {
          if (!cancelled) toast('Could Not Load Blocked Users');
          return;
        }
        const json = (await res.json()) as { blocks?: BlockRow[] };
        if (!cancelled) setRows(json.blocks ?? []);
      } catch {
        if (!cancelled) toast('Network Error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleUnblock = useCallback(async (row: BlockRow) => {
    setBusy((cur) => ({ ...cur, [row.blocked_id]: true }));
    try {
      const res = await fetch('/api/messenger/block-user', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ targetUserId: row.blocked_id, action: 'unblock' }),
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        toast(json.error ?? 'Could Not Unblock User');
        return;
      }
      setRows((cur) => cur.filter((r) => r.blocked_id !== row.blocked_id));
      toast('User Unblocked');
    } catch {
      toast('Network Error');
    } finally {
      setBusy((cur) => {
        const next = { ...cur };
        delete next[row.blocked_id];
        return next;
      });
    }
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Blocked Users"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(5, 10, 15, 0.78)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'max(16px, env(safe-area-inset-top, 0px)) 16px max(16px, env(safe-area-inset-bottom, 0px))',
        zIndex: 1300,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 460,
          maxHeight: '80vh',
          background: 'var(--surface-2, #162230)',
          border: '1px solid var(--surface-3, #1D2D3E)',
          borderRadius: 12,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <header
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '12px 14px',
            borderBottom: '1px solid var(--surface-3, #1D2D3E)',
          }}
        >
          <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--white, #FFFFFF)' }}>
            Blocked Users
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{ background: 'transparent', border: 0, color: 'var(--grey-400, #A8B4C0)', cursor: 'pointer' }}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>
        <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
          {loading ? (
            <div style={{ color: 'var(--grey-400, #A8B4C0)', textAlign: 'center', padding: 16 }}>
              Loading Blocked Users
            </div>
          ) : rows.length === 0 ? (
            <div style={{ color: 'var(--grey-400, #A8B4C0)', textAlign: 'center', padding: 16 }}>
              No Blocked Users
            </div>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {rows.map((row) => {
                const displayName = row.full_name?.trim() || row.username || 'Unknown User';
                const isBusy = Boolean(busy[row.blocked_id]);
                return (
                  <li
                    key={row.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: 10,
                      borderRadius: 8,
                      background: 'var(--surface-1, #0F1923)',
                      border: '1px solid var(--surface-3, #1D2D3E)',
                    }}
                  >
                    <Avatar name={displayName} size={36} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          color: 'var(--white, #FFFFFF)',
                          fontWeight: 600,
                          fontSize: '0.88rem',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {displayName}
                      </div>
                      <div style={{ color: 'var(--grey-400, #A8B4C0)', fontSize: '0.72rem' }}>
                        Blocked {formatDate(row.created_at)}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleUnblock(row)}
                      disabled={isBusy}
                      style={{
                        padding: '6px 10px',
                        borderRadius: 6,
                        border: '1px solid var(--teal, #00C4BC)',
                        background: isBusy ? 'var(--surface-3, #1D2D3E)' : 'transparent',
                        color: 'var(--teal, #00C4BC)',
                        cursor: isBusy ? 'wait' : 'pointer',
                        fontWeight: 700,
                        fontSize: '0.78rem',
                      }}
                    >
                      {isBusy ? 'Working' : 'Unblock'}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
