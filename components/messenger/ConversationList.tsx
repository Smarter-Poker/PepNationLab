'use client';
import { useCallback, useEffect, useState } from 'react';
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
 * round-22: For admin users, this list is a HIERARCHICAL view of the
 * admin's downline. Default = top-level agents + admin-referred
 * researchers. Tapping the chevron on an agent row drills into THEIR
 * downline (parent_agent_id = thatAgent OR referring_agent_id = thatAgent).
 * Tapping the row body opens the existing DM as before.
 *
 * Non-admin users see their full conversation list as before — drill
 * stack stays empty and the API returns the unfiltered set.
 */
export default function ConversationList({ selfId }: Props) {
  void selfId; // selfId is currently unused but kept for API consistency
  const conversations = useMessengerStore((s) => s.conversations);
  const activeId = useMessengerStore((s) => s.activeConversationId);
  const setActive = useMessengerStore((s) => s.setActive);
  const setConversations = useMessengerStore((s) => s.setConversations);
  const setLoading = useMessengerStore((s) => s.setLoadingConversations);
  const loading = useMessengerStore((s) => s.loadingConversations);

  // Drill-down stack. Each frame represents a level we've descended
  // INTO from the root admin view. Empty stack = root (admin's direct
  // downline). Non-admin users never push onto this stack.
  const [drill, setDrill] = useState<DrillFrame[]>([]);
  const currentParent = drill.length > 0 ? drill[drill.length - 1] : null;

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
    } finally {
      setLoading(false);
    }
  }, [setConversations, setLoading]);

  useEffect(() => {
    void fetchConversations(currentParent?.parentId ?? null);
  }, [fetchConversations, currentParent?.parentId]);

  const handleDrillInto = useCallback((c: { counterparty_id?: string | null; counterparty_full_name?: string | null; counterparty_username?: string | null; counterparty_role?: string | null }) => {
    if (!c.counterparty_id) return;
    const role = (c.counterparty_role ?? '').toString();
    // Only agents/super_agents are drillable. Researchers are leaves.
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
              {currentParent ? 'No Downline Conversations' : 'No Conversations Yet'}
            </div>
            <div style={{ fontSize: '0.84rem' }}>
              {currentParent ? 'This Agent Has No Downline DMs Yet.' : 'Start A New Conversation To Begin.'}
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
                    onClick={() => setActive(c.conversation_id)}
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
