'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useMessengerStore } from '@/stores/messengerStore';
import ConversationItem from './ConversationItem';
import { MessageSquare, ChevronRight, ChevronLeft } from 'lucide-react';

interface Props {
  selfId: string;
}

interface DrillFrame {
  parentId: string;
  parentLabel: string;
}

/**
 * round-22 / round-23: a HIERARCHICAL view of the downline tree.
 *
 * Default (root) = the viewer's normal list (admins see their direct
 * downline). Tapping the chevron on an agent/super_agent row drills into
 * THAT agent's downline. The drill list now includes downline members the
 * viewer has NOT messaged yet (the API returns `new:<id>` sentinel rows);
 * tapping such a row starts the DM and opens it, so every arrow is always
 * connected to the chat display. Tapping a row that already has a thread
 * opens it as before.
 */
export default function ConversationList({ selfId }: Props) {
  void selfId; // selfId is currently unused but kept for API consistency
  const conversations = useMessengerStore((s) => s.conversations);
  const activeId = useMessengerStore((s) => s.activeConversationId);
  const setActive = useMessengerStore((s) => s.setActive);
  const setConversations = useMessengerStore((s) => s.setConversations);
  const setLoading = useMessengerStore((s) => s.setLoadingConversations);
  const loading = useMessengerStore((s) => s.loadingConversations);

  const [drill, setDrill] = useState<DrillFrame[]>([]);
  const currentParent = drill.length > 0 ? drill[drill.length - 1] : null;

  // Per-counterparty in-flight set. Without this, a rapid double-click on a
  // `new:<id>` stub fires start-conversation twice, fn_find_direct_conversation
  // can't see the just-inserted row yet, and a SECOND empty conversation
  // gets created. This is exactly how the inbox accumulated orphan
  // "Direct Message / No Messages Yet" rows.
  const inFlight = useRef<Set<string>>(new Set());

  const fetchConversations = useCallback(async (parentId: string | null) => {
    setLoading(true);
    try {
      const res = await fetch('/api/messenger/get-conversations', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ parentId }),
      });
      if (!res.ok) return;
      const json = (await res.json()) as { conversations?: unknown };
      const list = Array.isArray(json.conversations) ? (json.conversations as never[]) : [];
      setConversations(list);
      const currentActive = useMessengerStore.getState().activeConversationId;
      if (currentActive) {
        const ids = new Set(list.map((c: { conversation_id?: string }) => c.conversation_id));
        if (!ids.has(currentActive)) setActive(null);
      }
    } finally {
      setLoading(false);
    }
  }, [setConversations, setLoading, setActive]);

  useEffect(() => {
    void fetchConversations(currentParent?.parentId ?? null);
  }, [fetchConversations, currentParent?.parentId]);

  const handleDrillInto = useCallback((c: { counterparty_id?: string | null; counterparty_full_name?: string | null; counterparty_username?: string | null; counterparty_role?: string | null }) => {
    if (!c.counterparty_id) return;
    const role = (c.counterparty_role ?? '').toString();
    if (role !== 'agent' && role !== 'super_agent') return;
    setDrill((stack) => [
      ...stack,
      {
        parentId: c.counterparty_id as string,
        parentLabel: c.counterparty_full_name || c.counterparty_username || 'Downline',
      },
    ]);
    setActive(null);
  }, [setActive]);

  const handleOpen = useCallback(async (c: { conversation_id?: string; counterparty_id?: string | null }) => {
    const cid = (c.conversation_id ?? '').toString();
    if (cid.startsWith('new:')) {
      const counterpartyId = (c.counterparty_id ?? cid.slice(4)).toString();
      if (!counterpartyId) return;
      // Dedupe rapid clicks on the same downline person. Without this,
      // every click during the start-conversation round-trip would fire
      // ANOTHER start-conversation and accumulate empty rows.
      if (inFlight.current.has(counterpartyId)) return;
      inFlight.current.add(counterpartyId);
      try {
        const res = await fetch('/api/messenger/start-conversation', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ type: 'direct', participantIds: [counterpartyId] }),
        });
        if (!res.ok) return;
        const json = (await res.json()) as { conversationId?: string };
        if (json.conversationId) {
          await fetchConversations(currentParent?.parentId ?? null);
          setActive(json.conversationId);
        }
      } catch {
        /* leave the list as-is on failure */
      } finally {
        inFlight.current.delete(counterpartyId);
      }
      return;
    }
    setActive(cid);
  }, [fetchConversations, currentParent?.parentId, setActive]);

  const handleBack = useCallback(() => {
    setDrill((stack) => stack.slice(0, -1));
    setActive(null);
  }, [setActive]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {currentParent && (
        <button
          type="button"
          onClick={handleBack}
          aria-label="Back To Previous Level"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '10px 14px',
            background: 'var(--surface-2, #162230)',
            border: 'none',
            borderBottom: '1px solid var(--surface-3, #1D2D3E)',
            color: 'var(--white, #FFFFFF)',
            cursor: 'pointer',
            textAlign: 'left',
            fontSize: '0.88rem',
            fontWeight: 600,
          }}
        >
          <ChevronLeft size={16} aria-hidden="true" />
          <span style={{ color: 'var(--grey-400, #A8B4C0)', fontWeight: 500 }}>Back —</span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {currentParent.parentLabel}
          </span>
        </button>
      )}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {loading && conversations.length === 0 ? (
          <div style={{ padding: 24, color: 'var(--grey-400, #A8B4C0)', fontSize: '0.9rem' }}>
            Loading Conversations
          </div>
        ) : conversations.length === 0 ? (
          <div
            style={{
              padding: 24,
              textAlign: 'center',
              color: 'var(--grey-400, #A8B4C0)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 12,
              marginTop: 32,
            }}
          >
            <MessageSquare size={36} aria-hidden="true" />
            <div style={{ fontWeight: 600, color: 'var(--white, #FFFFFF)' }}>
              {currentParent ? 'No Downline Members' : 'No Conversations Yet'}
            </div>
            <div style={{ fontSize: '0.84rem' }}>
              {currentParent ? 'This Agent Has No Downline Accounts Yet.' : 'Start A New Conversation To Begin.'}
            </div>
          </div>
        ) : (
          conversations.map((c) => {
            const role = ((c as { counterparty_role?: string | null }).counterparty_role ?? '').toString();
            const isDrillable = role === 'agent' || role === 'super_agent';
            return (
              <div
                key={c.conversation_id}
                style={{ position: 'relative', display: 'flex', alignItems: 'stretch' }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <ConversationItem
                    conversation={c}
                    active={activeId === c.conversation_id}
                    onClick={() => handleOpen(c as never)}
                  />
                </div>
                {isDrillable && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleDrillInto(c as never); }}
                    aria-label={`Drill Into ${(c as { counterparty_full_name?: string | null }).counterparty_full_name ?? 'Agent'} Downline`}
                    title="View Downline"
                    style={{
                      flexShrink: 0,
                      width: 44,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'transparent',
                      border: 'none',
                      borderLeft: '1px solid var(--surface-3, #1D2D3E)',
                      color: 'var(--grey-400, #A8B4C0)',
                      cursor: 'pointer',
                    }}
                  >
                    <ChevronRight size={20} aria-hidden="true" />
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
