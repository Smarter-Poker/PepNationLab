'use client';
import { useEffect } from 'react';
import ConversationList from './ConversationList';
import MessagePane from './MessagePane';
import SearchBar from './SearchBar';

interface Props {
  userId: string;
}

const PRESENCE_INTERVAL_MS = 30_000;

export default function MessengerShell({ userId }: Props) {
  useEffect(() => {
    let cancelled = false;
    const ping = async () => {
      try {
        await fetch('/api/messenger/update-presence', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: '{}',
        });
      } catch {
        // network blips are tolerated
      }
    };
    void ping();
    const id = setInterval(() => {
      if (!cancelled) void ping();
    }, PRESENCE_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [userId]);

  return (
    <section className="section" style={{ padding: 0 }}>
      <div
        style={{
          display: 'flex',
          height: 'calc(100vh - 140px)',
          minHeight: 480,
          border: '1px solid var(--surface-3, #1D2D3E)',
          borderRadius: 12,
          overflow: 'hidden',
          background: 'var(--surface-1, #0F1923)',
          margin: '0 auto',
          maxWidth: 1200,
        }}
      >
        <aside
          style={{
            width: 320,
            borderRight: '1px solid var(--surface-3, #1D2D3E)',
            background: 'var(--surface-2, #162230)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <header
            style={{
              padding: '10px 12px',
              borderBottom: '1px solid var(--surface-3, #1D2D3E)',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <div style={{ fontWeight: 700, fontSize: '1rem' }}>Messenger</div>
            <SearchBar />
          </header>
          <ConversationList selfId={userId} />
        </aside>
        <MessagePane userId={userId} />
      </div>
    </section>
  );
}
