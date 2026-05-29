'use client';

interface ResultMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  text: string | null;
  message_type: string;
  created_at: string;
}

interface ResultConversation {
  id: string;
  type: string;
  title: string | null;
  avatar_url: string | null;
  last_message_text: string | null;
  last_message_at: string | null;
}

interface Props {
  messages: ResultMessage[];
  conversations: ResultConversation[];
  loading: boolean;
  onPick: (conversationId: string, messageId?: string) => void;
  onClose: () => void;
}

function snippet(text: string | null): string {
  if (!text) return '(Media)';
  return text.length > 120 ? text.slice(0, 120) + '...' : text;
}

export default function SearchResults({ messages, conversations, loading, onPick, onClose }: Props) {
  return (
    <div
      role="dialog"
      aria-label="Search Results"
      style={{
        position: 'absolute', top: 44, left: 0, right: 0,
        background: 'var(--surface-2, #162230)', border: '1px solid var(--surface-3, #1D2D3E)',
        borderRadius: 10, padding: 6, boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
        maxHeight: 360, overflowY: 'auto', zIndex: 60,
      }}
    >
      {loading && (
        <div style={{ color: 'var(--grey-400, #A8B4C0)', fontSize: '0.84rem', padding: 8 }}>Loading</div>
      )}
      {!loading && messages.length === 0 && conversations.length === 0 && (
        <div style={{ color: 'var(--grey-400, #A8B4C0)', fontSize: '0.84rem', padding: 8 }}>No Results</div>
      )}
      {conversations.length > 0 && (
        <div style={{ marginBottom: 4 }}>
          <div style={sectionLabel}>Conversations</div>
          {conversations.map((c) => (
            <button key={c.id} type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { onPick(c.id); onClose(); }}
              style={resultBtn}
              aria-label={`Open Conversation ${c.title ?? c.id}`}
            >
              <span style={{ fontWeight: 600 }}>{c.title ?? 'Direct Message'}</span>
            </button>
          ))}
        </div>
      )}
      {messages.length > 0 && (
        <div>
          <div style={sectionLabel}>Messages</div>
          {messages.map((m) => (
            <button key={m.id} type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { onPick(m.conversation_id, m.id); onClose(); }}
              style={resultBtn}
              aria-label="Open Message"
            >
              <span style={{ display: 'block', color: 'var(--grey-400, #A8B4C0)', fontSize: '0.72rem' }}>
                {new Date(m.created_at).toLocaleString()}
              </span>
              <span style={{ display: 'block' }}>{snippet(m.text)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const sectionLabel: React.CSSProperties = {
  fontSize: '0.72rem',
  color: 'var(--grey-400, #A8B4C0)',
  padding: '4px 8px',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
};

const resultBtn: React.CSSProperties = {
  display: 'block', width: '100%', textAlign: 'left',
  background: 'transparent', border: 0, color: 'var(--white, #FFFFFF)',
  cursor: 'pointer', padding: '8px', borderRadius: 6, fontSize: '0.88rem',
};
