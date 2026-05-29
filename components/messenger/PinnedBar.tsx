'use client';
import { useCallback, useEffect, useState } from 'react';
import { Pin, X } from 'lucide-react';
import { toast } from 'sonner';
import type { ParticipantRole } from '@/lib/messenger/types';

interface PinnedMessageRow {
  id: string;
  message_id: string;
  pinned_by: string;
  created_at: string;
  message: {
    id: string;
    text: string | null;
    message_type: string;
    sender_id: string;
    created_at: string;
    media_url: string | null;
    is_deleted: boolean;
  } | null;
}

interface Props {
  conversationId: string;
  selfId: string;
  selfRole: ParticipantRole | null;
  refreshKey: number;
  onJump: (messageId: string) => void;
}

function snippet(row: PinnedMessageRow): string {
  if (!row.message) return 'Message';
  if (row.message.is_deleted) return 'Message Deleted';
  if (row.message.text && row.message.text.trim().length > 0) {
    return row.message.text.length > 60 ? `${row.message.text.slice(0, 60)}…` : row.message.text;
  }
  switch (row.message.message_type) {
    case 'image': return 'Image';
    case 'gif': return 'Gif';
    case 'voice': return 'Voice Note';
    case 'file': return 'File';
    default: return 'Message';
  }
}

export default function PinnedBar({ conversationId, selfId, selfRole, refreshKey, onJump }: Props) {
  const [pins, setPins] = useState<PinnedMessageRow[]>([]);
  const [loading, setLoading] = useState(false);
  const canManage = selfRole === 'owner' || selfRole === 'admin';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/messenger/list-pins', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ conversationId }),
      });
      if (!res.ok) return;
      const json = (await res.json()) as { pins?: PinnedMessageRow[] };
      setPins(json.pins ?? []);
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  useEffect(() => { void load(); }, [load, refreshKey]);

  const handleUnpin = async (row: PinnedMessageRow) => {
    try {
      const res = await fetch('/api/messenger/pin-message', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          messageId: row.message_id,
          conversationId,
          action: 'unpin',
        }),
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        toast(json.error ?? 'Could Not Unpin');
        return;
      }
      setPins((cur) => cur.filter((p) => p.id !== row.id));
    } catch {
      toast('Network Error');
    }
  };

  if (loading && pins.length === 0) return null;
  if (pins.length === 0) return null;

  return (
    <div
      aria-label="Pinned Messages"
      style={{
        display: 'flex',
        gap: 8,
        overflowX: 'auto',
        padding: '8px 12px',
        background: 'var(--surface-1, #0F1923)',
        borderBottom: '1px solid var(--surface-3, #1D2D3E)',
      }}
    >
      {pins.map((row) => {
        const canRemove = canManage || row.pinned_by === selfId;
        return (
          <div
            key={row.id}
            style={{
              flex: '0 0 auto',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 10px',
              borderRadius: 8,
              background: 'var(--surface-2, #162230)',
              border: '1px solid var(--surface-3, #1D2D3E)',
              maxWidth: 320,
            }}
          >
            <button
              type="button"
              onClick={() => onJump(row.message_id)}
              aria-label="Jump To Pinned Message"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                background: 'transparent',
                border: 0,
                color: 'var(--white, #FFFFFF)',
                cursor: 'pointer',
                fontSize: '0.82rem',
                fontWeight: 600,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: 260,
              }}
            >
              <Pin size={12} aria-hidden="true" style={{ color: 'var(--teal, #00C4BC)', flex: '0 0 auto' }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{snippet(row)}</span>
            </button>
            {canRemove && (
              <button
                type="button"
                onClick={() => void handleUnpin(row)}
                aria-label="Unpin Message"
                title="Unpin Message"
                style={{
                  background: 'transparent',
                  border: 0,
                  color: 'var(--grey-400, #A8B4C0)',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: 2,
                }}
              >
                <X size={12} aria-hidden="true" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
