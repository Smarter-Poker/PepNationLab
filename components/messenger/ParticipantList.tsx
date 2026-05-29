'use client';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import Avatar from './Avatar';
import type { ParticipantRole } from '@/lib/messenger/types';

interface ParticipantRow {
  id: string;
  user_id: string;
  role: ParticipantRole;
  joined_at: string;
  full_name: string | null;
  username: string | null;
  email: string | null;
  profile_role: string | null;
}

interface Props {
  conversationId: string;
  selfId: string;
  selfRole: ParticipantRole | null;
  refreshKey?: number;
  onChanged?: () => void;
}

function labelOf(p: ParticipantRow): string {
  return p.full_name?.trim() || p.username?.trim() || p.email?.trim() || 'Unknown';
}

const ROLE_OPTIONS: ParticipantRole[] = ['owner', 'admin', 'moderator', 'member'];

export default function ParticipantList({
  conversationId,
  selfId,
  selfRole,
  refreshKey = 0,
  onChanged,
}: Props) {
  const [rows, setRows] = useState<ParticipantRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/messenger/list-participants', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ conversationId }),
      });
      if (!res.ok) {
        toast('Could Not Load Participants');
        return;
      }
      const json = (await res.json()) as { participants?: ParticipantRow[] };
      setRows(json.participants ?? []);
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const canChangeRole = selfRole === 'owner';
  const canRemoveOthers = selfRole === 'owner' || selfRole === 'admin';

  const handleRoleChange = async (target: ParticipantRow, nextRole: ParticipantRole) => {
    if (nextRole === target.role) return;
    setBusyId(target.id);
    try {
      const res = await fetch('/api/messenger/set-participant-role', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ conversationId, userId: target.user_id, role: nextRole }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast(json.error ?? 'Could Not Change Role');
        return;
      }
      await load();
      onChanged?.();
    } finally {
      setBusyId(null);
    }
  };

  const handleRemove = async (target: ParticipantRow) => {
    const label = labelOf(target);
    if (!window.confirm(`Remove ${label} From This Conversation?`)) return;
    setBusyId(target.id);
    try {
      const res = await fetch('/api/messenger/remove-participant', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ conversationId, userId: target.user_id }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast(json.error ?? 'Could Not Remove Participant');
        return;
      }
      await load();
      onChanged?.();
    } finally {
      setBusyId(null);
    }
  };

  if (loading && rows.length === 0) {
    return (
      <div style={{ padding: 12, color: 'var(--grey-400, #A8B4C0)', fontSize: '0.85rem' }}>
        Loading Participants
      </div>
    );
  }

  return (
    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
      {rows.map((p) => {
        const isSelf = p.user_id === selfId;
        const showRoleSelect = canChangeRole && !isSelf;
        const showRemove = canRemoveOthers && !isSelf;
        const busy = busyId === p.id;
        return (
          <li
            key={p.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '8px 10px',
              background: 'var(--surface-1, #0F1923)',
              border: '1px solid var(--surface-3, #1D2D3E)',
              borderRadius: 8,
            }}
          >
            <Avatar name={labelOf(p)} avatarUrl={null} size={32} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: '0.88rem',
                  color: 'var(--white, #FFFFFF)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {labelOf(p)} {isSelf ? '(You)' : ''}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--grey-400, #A8B4C0)', textTransform: 'capitalize' }}>
                {p.role}
              </div>
            </div>
            {showRoleSelect ? (
              <select
                value={p.role}
                disabled={busy}
                onChange={(e) => void handleRoleChange(p, e.target.value as ParticipantRole)}
                aria-label={`Set Role For ${labelOf(p)}`}
                style={{
                  background: 'var(--surface-2, #162230)',
                  border: '1px solid var(--surface-3, #1D2D3E)',
                  borderRadius: 6,
                  color: 'var(--white, #FFFFFF)',
                  fontSize: '0.78rem',
                  padding: '4px 6px',
                  textTransform: 'capitalize',
                }}
              >
                {ROLE_OPTIONS.map((r) => (
                  <option key={r} value={r} style={{ textTransform: 'capitalize' }}>
                    {r}
                  </option>
                ))}
              </select>
            ) : null}
            {showRemove ? (
              <button
                type="button"
                onClick={() => void handleRemove(p)}
                disabled={busy}
                style={{
                  padding: '4px 8px',
                  borderRadius: 6,
                  border: '1px solid var(--surface-3, #1D2D3E)',
                  background: 'transparent',
                  color: 'var(--white, #FFFFFF)',
                  cursor: busy ? 'not-allowed' : 'pointer',
                  fontSize: '0.76rem',
                }}
              >
                Remove
              </button>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
