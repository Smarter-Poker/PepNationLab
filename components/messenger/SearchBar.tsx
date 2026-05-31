'use client';
import { useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { useMessengerStore } from '@/stores/messengerStore';
import SearchResults from './SearchResults';

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

const DEBOUNCE_MS = 300;

export default function SearchBar() {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ResultMessage[]>([]);
  const [conversations, setConversations] = useState<ResultConversation[]>([]);
  const setActive = useMessengerStore((s) => s.setActive);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    const term = q.trim();
    if (!term) { setMessages([]); setConversations([]); return; }
    timer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/messenger/global-search', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ q: term }),
        });
        if (!res.ok) {
          setMessages([]); setConversations([]); return;
        }
        const json = (await res.json()) as { messages?: ResultMessage[]; conversations?: ResultConversation[] };
        setMessages(json.messages ?? []);
        setConversations(json.conversations ?? []);
      } finally {
        setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [q]);

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
          background: 'rgba(0, 0, 0, 0.4)',
          border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: 12,
          boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.6)',
          transition: 'all 0.2s',
        }}
        className="hover-lift"
      >
        <Search size={14} aria-hidden="true" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => { if (q.trim()) setOpen(true); }}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Search Messages"
          aria-label="Search Messages"
          style={{
            flex: 1, background: 'transparent', color: 'var(--white, #FFFFFF)',
            border: 0, outline: 'none', fontSize: '0.9rem',
          }}
        />
      </div>
      {open && q.trim() && (
        <SearchResults
          messages={messages}
          conversations={conversations}
          loading={loading}
          onPick={(convId, msgId) => {
            setActive(convId);
            if (msgId && typeof window !== 'undefined') {
              setTimeout(() => {
                const el = document.querySelector(`[data-msg-id="${msgId}"]`);
                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }, 200);
            }
            setQ('');
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}
