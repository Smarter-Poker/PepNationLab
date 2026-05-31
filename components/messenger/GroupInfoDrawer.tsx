'use client';
import { useEffect, useState } from 'react';
import { X, UserPlus, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { useMessengerStore } from '@/stores/messengerStore';
import type { ConversationListItem, ParticipantRole } from '@/lib/messenger/types';
import type { ThemeValue } from '@/lib/messenger/schemas';
import ParticipantList from './ParticipantList';
import ContactPicker, { type Contact } from './ContactPicker';
import ThemePicker from './ThemePicker';

interface Props {
  conversation: ConversationListItem;
  selfId: string;
  onClose: () => void;
  currentTheme?: ThemeValue;
  onThemeChange?: (next: ThemeValue) => void;
  onOpenBlockList?: () => void;
}

export default function GroupInfoDrawer({
  conversation,
  selfId,
  onClose,
  currentTheme = 'default',
  onThemeChange,
  onOpenBlockList,
}: Props) {
  const conversations = useMessengerStore((s) => s.conversations);
  const setConversations = useMessengerStore((s) => s.setConversations);
  const setActive = useMessengerStore((s) => s.setActive);

  const [selfRole, setSelfRole] = useState<ParticipantRole | null>(null);
  const [isMuted, setIsMuted] = useState<boolean>(conversation.is_muted ?? false);
  const [muteBusy, setMuteBusy] = useState(false);
  // Audit fix (Phase 9): `archived` must be initialized from the caller's own
  // messenger_participants.settings.archived row, not hardcoded false. We pull
  // it from list-participants which now returns `settings` for the caller.
  const [archived, setArchived] = useState<boolean>(false);
  const [archiveBusy, setArchiveBusy] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Add People dialog state
  const [adding, setAdding] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [excludeIds, setExcludeIds] = useState<Set<string>>(new Set([selfId]));
  const [addBusy, setAddBusy] = useState(false);

  // Load self role + per-participant archive flag + exclude list for add-people.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/messenger/list-participants', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ conversationId: conversation.conversation_id }),
        });
        if (!res.ok) return;
        const json = (await res.json()) as {
          participants?: Array<{ user_id: string; role: ParticipantRole; settings?: Record<string, unknown> | null }>;
        };
        if (cancelled) return;
        const me = json.participants?.find((p) => p.user_id === selfId);
        setSelfRole(me?.role ?? null);
        const archivedFlag = Boolean(me?.settings && (me.settings as { archived?: unknown }).archived === true);
        setArchived(archivedFlag);
        const excluded = new Set<string>([selfId]);
        (json.participants ?? []).forEach((p) => excluded.add(p.user_id));
        setExcludeIds(excluded);
      } catch {
        // best-effort
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [conversation.conversation_id, selfId, refreshKey]);

  const handleMuteToggle = async () => {
    setMuteBusy(true);
    try {
      const payload = isMuted
        ? { conversationId: conversation.conversation_id, unmute: true }
        : { conversationId: conversation.conversation_id };
      const res = await fetch('/api/messenger/mute-conversation', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        toast(json.error ?? 'Could Not Update Mute');
        return;
      }
      const nextMuted = !isMuted;
      setIsMuted(nextMuted);
      setConversations(
        conversations.map((c) =>
          c.conversation_id === conversation.conversation_id ? { ...c, is_muted: nextMuted } : c,
        ),
      );
    } finally {
      setMuteBusy(false);
    }
  };

  const handleArchiveToggle = async () => {
    setArchiveBusy(true);
    try {
      const next = !archived;
      const res = await fetch('/api/messenger/archive-conversation', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ conversationId: conversation.conversation_id, archived: next }),
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        toast(json.error ?? 'Could Not Update Archive');
        return;
      }
      setArchived(next);
      toast(next ? 'Archived' : 'Unarchived');
    } finally {
      setArchiveBusy(false);
    }
  };

  const handleLeave = async () => {
    if (!window.confirm('Leave This Conversation?')) return;
    try {
      const res = await fetch('/api/messenger/leave-conversation', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ conversationId: conversation.conversation_id }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast(json.error ?? 'Could Not Leave Conversation');
        return;
      }
      setConversations(conversations.filter((c) => c.conversation_id !== conversation.conversation_id));
      setActive(null);
      onClose();
    } catch {
      toast('Network Error');
    }
  };

  const openAddPeople = async () => {
    setAdding(true);
    if (contacts.length > 0) return;
    setContactsLoading(true);
    try {
      const res = await fetch('/api/messenger/list-contacts', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      });
      if (!res.ok) {
        toast('Could Not Load Contacts');
        return;
      }
      const json = (await res.json()) as { contacts?: Contact[] };
      setContacts(json.contacts ?? []);
    } finally {
      setContactsLoading(false);
    }
  };

  const handleAddPeople = async () => {
    if (picked.size === 0) return;
    setAddBusy(true);
    let failures = 0;
    try {
      for (const id of Array.from(picked)) {
        const res = await fetch('/api/messenger/add-participant', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ conversationId: conversation.conversation_id, userId: id }),
        });
        if (!res.ok) failures += 1;
      }
      if (failures > 0) toast(`Could Not Add ${failures} Contact${failures > 1 ? 's' : ''}`);
      else toast('Contacts Added');
      setPicked(new Set());
      setAdding(false);
      setRefreshKey((k) => k + 1);
    } finally {
      setAddBusy(false);
    }
  };

  const canManage = selfRole === 'owner' || selfRole === 'admin';
  const isDirect = conversation.type === 'direct';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Conversation Info"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(5, 10, 15, 0.78)',
        display: 'flex',
        justifyContent: 'flex-end',
        zIndex: 1100,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <aside
        style={{
          width: 'min(420px, 100%)',
          height: '100%',
          background: 'var(--surface-2, #162230)',
          borderLeft: '1px solid var(--surface-3, #1D2D3E)',
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
          <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Conversation Info</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{ background: 'transparent', border: 0, color: 'var(--grey-400, #A8B4C0)', cursor: 'pointer' }}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <div style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <section>
            <div style={{ fontSize: '0.74rem', color: 'var(--grey-400, #A8B4C0)', textTransform: 'uppercase' }}>
              Title
            </div>
            <div style={{ fontSize: '1rem', color: 'var(--white, #FFFFFF)', fontWeight: 600 }}>
              {conversation.title?.trim() ||
                conversation.counterparty_full_name?.trim() ||
                (isDirect ? 'Direct Message' : 'Group')}
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--grey-400, #A8B4C0)', textTransform: 'capitalize' }}>
              {conversation.type}
            </div>
          </section>

          <section style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: '0.74rem', color: 'var(--grey-400, #A8B4C0)', textTransform: 'uppercase' }}>
              Theme
            </div>
            <ThemePicker
              conversationId={conversation.conversation_id}
              currentTheme={currentTheme}
              onChange={(next) => onThemeChange?.(next)}
            />
          </section>

          <section style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: '0.74rem', color: 'var(--grey-400, #A8B4C0)', textTransform: 'uppercase' }}>
              Safety
            </div>
            <button
              type="button"
              onClick={() => onOpenBlockList?.()}
              style={{
                padding: '8px 12px',
                borderRadius: 8,
                border: '1px solid var(--surface-3, #1D2D3E)',
                background: 'var(--surface-1, #0F1923)',
                color: 'var(--white, #FFFFFF)',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.86rem',
                textAlign: 'left',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <Shield size={14} aria-hidden="true" />
              Blocked Users
            </button>
          </section>

          <section style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: '0.74rem', color: 'var(--grey-400, #A8B4C0)', textTransform: 'uppercase' }}>
              Notifications
            </div>
            <button
              type="button"
              onClick={handleMuteToggle}
              disabled={muteBusy}
              style={{
                padding: '8px 12px',
                borderRadius: 8,
                border: '1px solid var(--surface-3, #1D2D3E)',
                background: 'var(--surface-1, #0F1923)',
                color: 'var(--white, #FFFFFF)',
                cursor: muteBusy ? 'wait' : 'pointer',
                fontWeight: 600,
                fontSize: '0.86rem',
                textAlign: 'left',
              }}
            >
              {isMuted ? 'Unmute Conversation' : 'Mute Conversation'}
            </button>
          </section>

          <section style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: '0.74rem', color: 'var(--grey-400, #A8B4C0)', textTransform: 'uppercase' }}>
              Archive
            </div>
            <button
              type="button"
              onClick={handleArchiveToggle}
              disabled={archiveBusy}
              style={{
                padding: '8px 12px',
                borderRadius: 8,
                border: '1px solid var(--surface-3, #1D2D3E)',
                background: 'var(--surface-1, #0F1923)',
                color: 'var(--white, #FFFFFF)',
                cursor: archiveBusy ? 'wait' : 'pointer',
                fontWeight: 600,
                fontSize: '0.86rem',
                textAlign: 'left',
              }}
            >
              {archived ? 'Unarchive Conversation' : 'Archive Conversation'}
            </button>
          </section>

          {!isDirect && (
            <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div style={{ fontSize: '0.74rem', color: 'var(--grey-400, #A8B4C0)', textTransform: 'uppercase' }}>
                  Participants
                </div>
                {canManage && (
                  <button
                    type="button"
                    onClick={openAddPeople}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '4px 10px',
                      borderRadius: 6,
                      border: '1px solid var(--teal, #00C4BC)',
                      background: 'transparent',
                      color: 'var(--teal, #00C4BC)',
                      cursor: 'pointer',
                      fontWeight: 700,
                      fontSize: '0.78rem',
                    }}
                  >
                    <UserPlus size={12} aria-hidden="true" />
                    Add People
                  </button>
                )}
              </div>
              <ParticipantList
                conversationId={conversation.conversation_id}
                selfId={selfId}
                selfRole={selfRole}
                refreshKey={refreshKey}
                onChanged={() => setRefreshKey((k) => k + 1)}
              />
            </section>
          )}

          {!isDirect && (
            <section>
              <button
                type="button"
                onClick={handleLeave}
                style={{
                  padding: '8px 12px',
                  borderRadius: 8,
                  border: '1px solid var(--danger, #E53E3E)',
                  background: 'transparent',
                  color: 'var(--danger, #E53E3E)',
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontSize: '0.86rem',
                  width: '100%',
                }}
              >
                Leave Conversation
              </button>
            </section>
          )}
        </div>

        {adding && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Add People"
            style={{
              position: 'absolute',
              inset: 0,
              background: 'rgba(5, 10, 15, 0.78)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 16,
              zIndex: 1200,
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget) setAdding(false);
            }}
          >
            <div
              style={{
                width: '100%',
                maxWidth: 420,
                background: 'var(--surface-2, #162230)',
                border: '1px solid var(--surface-3, #1D2D3E)',
                borderRadius: 12,
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                padding: 14,
                maxHeight: '80vh',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '0.98rem', fontWeight: 700 }}>Add People</h3>
                <button
                  type="button"
                  onClick={() => setAdding(false)}
                  aria-label="Close"
                  style={{
                    background: 'transparent',
                    border: 0,
                    color: 'var(--grey-400, #A8B4C0)',
                    cursor: 'pointer',
                  }}
                >
                  <X size={16} aria-hidden="true" />
                </button>
              </div>
              {contactsLoading ? (
                <div style={{ padding: 12, color: 'var(--grey-400, #A8B4C0)', fontSize: '0.85rem' }}>
                  Loading Contacts
                </div>
              ) : (
                <ContactPicker
                  contacts={contacts}
                  multi={true}
                  selectedIds={picked}
                  onChange={setPicked}
                  excludeIds={excludeIds}
                />
              )}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setAdding(false)}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 8,
                    border: '1px solid var(--surface-3, #1D2D3E)',
                    background: 'transparent',
                    color: 'var(--white, #FFFFFF)',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: '0.86rem',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAddPeople}
                  disabled={picked.size === 0 || addBusy}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 8,
                    border: 0,
                    background:
                      picked.size === 0 || addBusy ? 'var(--surface-3, #1D2D3E)' : 'var(--teal, #00C4BC)',
                    color: picked.size === 0 || addBusy ? 'var(--grey-400, #A8B4C0)' : '#000',
                    cursor: picked.size === 0 || addBusy ? 'not-allowed' : 'pointer',
                    fontWeight: 700,
                    fontSize: '0.86rem',
                  }}
                >
                  {addBusy ? 'Adding' : 'Add'}
                </button>
              </div>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
