'use client';
import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import ContactPicker, { type Contact } from './ContactPicker';
import { useMessengerStore } from '@/stores/messengerStore';
import type { ConversationListItem } from '@/lib/messenger/types';
import { useModalA11y } from '@/lib/useModalA11y';

interface Props {
  selfId: string;
  onClose: () => void;
}

type Mode = 'direct' | 'group';

export default function NewConversationDialog({ selfId, onClose }: Props) {
  const setActive = useMessengerStore((s) => s.setActive);
  const conversations = useMessengerStore((s) => s.conversations);
  const setConversations = useMessengerStore((s) => s.setConversations);

  const [mode, setMode] = useState<Mode>('direct');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [title, setTitle] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // A11y: initial focus, Tab trap, Escape-to-close, focus restore
  const dialogRef = useModalA11y<HTMLDivElement>(true, { onClose });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Audit13: force a fresh fetch on every dialog mount so the browser
        // never serves a stale empty contact list cached by an earlier deploy.
        const res = await fetch('/api/messenger/list-contacts', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: '{}',
          cache: 'no-store',
        });
        if (!res.ok) {
          toast('Could Not Load Contacts');
          return;
        }
        const json = (await res.json()) as { contacts?: Contact[] };
        if (cancelled) return;
        setContacts(json.contacts ?? []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    // Reset selection whenever the mode changes so a stray multi-select from
    // group mode does not leak into direct mode.
    setSelectedIds(new Set());
  }, [mode]);

  const canSubmit = () => {
    if (submitting) return false;
    if (mode === 'direct') return selectedIds.size === 1;
    return selectedIds.size >= 2 && title.trim().length > 0;
  };

  const handleCreate = async () => {
    if (!canSubmit()) return;
    setSubmitting(true);
    try {
      const ids = Array.from(selectedIds);
      const payload =
        mode === 'direct'
          ? { type: 'direct' as const, participantIds: ids }
          : { type: 'group' as const, participantIds: ids, title: title.trim() };
      const res = await fetch('/api/messenger/start-conversation', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = (await res.json().catch(() => ({}))) as { conversationId?: string; error?: string };
      if (!res.ok || !json.conversationId) {
        toast(json.error ?? 'Could Not Create Conversation');
        return;
      }
      // Optimistic stub in the list so the user sees it immediately when not
      // already present. The next get-conversations refresh will replace.
      if (!conversations.some((c) => c.conversation_id === json.conversationId)) {
        const stub: ConversationListItem = {
          conversation_id: json.conversationId,
          type: mode,
          title: mode === 'group' ? title.trim() : null,
          avatar_url: null,
          last_message_text: null,
          last_message_at: null,
          unread_count: 0,
          is_pinned: false,
          is_muted: false,
        };
        setConversations([stub, ...conversations]);
      }
      setActive(json.conversationId);
      onClose();
    } catch {
      toast('Network Error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="Start A New Conversation"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(5, 10, 15, 0.78)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 16,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 480,
          background: 'var(--surface-2, #162230)',
          border: '1px solid var(--surface-3, #1D2D3E)',
          borderRadius: 12,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          padding: 16,
          maxHeight: '90vh',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>Start A New Conversation</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              background: 'transparent',
              border: 0,
              color: 'var(--grey-400, #A8B4C0)',
              cursor: 'pointer',
            }}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div
          role="tablist"
          aria-label="Conversation Type"
          style={{
            display: 'flex',
            gap: 4,
            background: 'var(--surface-1, #0F1923)',
            border: '1px solid var(--surface-3, #1D2D3E)',
            borderRadius: 8,
            padding: 4,
          }}
        >
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'direct'}
            onClick={() => setMode('direct')}
            style={{
              flex: 1,
              padding: '6px 10px',
              borderRadius: 6,
              border: 0,
              cursor: 'pointer',
              background: mode === 'direct' ? 'var(--teal, #00C4BC)' : 'transparent',
              color: mode === 'direct' ? '#000' : 'var(--white, #FFFFFF)',
              fontWeight: 600,
              fontSize: '0.85rem',
            }}
          >
            Direct Message
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'group'}
            onClick={() => setMode('group')}
            style={{
              flex: 1,
              padding: '6px 10px',
              borderRadius: 6,
              border: 0,
              cursor: 'pointer',
              background: mode === 'group' ? 'var(--teal, #00C4BC)' : 'transparent',
              color: mode === 'group' ? '#000' : 'var(--white, #FFFFFF)',
              fontWeight: 600,
              fontSize: '0.85rem',
            }}
          >
            Group
          </button>
        </div>

        {mode === 'group' && (
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--grey-400, #A8B4C0)' }}>Group Name</span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Project Atlas"
              maxLength={120}
              style={{
                background: 'var(--surface-1, #0F1923)',
                border: '1px solid var(--surface-3, #1D2D3E)',
                borderRadius: 8,
                padding: '8px 10px',
                color: 'var(--white, #FFFFFF)',
                fontSize: '0.92rem',
              }}
            />
          </label>
        )}

        <div style={{ fontSize: '0.82rem', color: 'var(--grey-400, #A8B4C0)' }}>
          {mode === 'direct' ? 'Pick One Contact' : 'Pick Contacts'}
        </div>

        {loading ? (
          <div style={{ padding: 16, color: 'var(--grey-400, #A8B4C0)', fontSize: '0.85rem', textAlign: 'center' }}>
            Loading Contacts
          </div>
        ) : (
          <ContactPicker
            contacts={contacts}
            multi={mode === 'group'}
            selectedIds={selectedIds}
            onChange={setSelectedIds}
            excludeIds={new Set([selfId])}
          />
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '8px 14px',
              borderRadius: 8,
              border: '1px solid var(--surface-3, #1D2D3E)',
              background: 'transparent',
              color: 'var(--white, #FFFFFF)',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '0.88rem',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleCreate}
            disabled={!canSubmit()}
            style={{
              padding: '8px 14px',
              borderRadius: 8,
              border: 0,
              background: canSubmit() ? 'var(--teal, #00C4BC)' : 'var(--surface-3, #1D2D3E)',
              color: canSubmit() ? '#000' : 'var(--grey-400, #A8B4C0)',
              cursor: canSubmit() ? 'pointer' : 'not-allowed',
              fontWeight: 700,
              fontSize: '0.88rem',
            }}
          >
            {submitting ? 'Creating' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}
