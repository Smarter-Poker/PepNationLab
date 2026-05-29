'use client';
import ConversationList from './ConversationList';
import MessagePane from './MessagePane';

interface Props {
  userId: string;
}

export default function MessengerShell({ userId }: Props) {
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
              padding: '14px 16px',
              borderBottom: '1px solid var(--surface-3, #1D2D3E)',
              fontWeight: 700,
              fontSize: '1rem',
            }}
          >
            Messenger
          </header>
          <ConversationList />
        </aside>
        <MessagePane userId={userId} />
      </div>
    </section>
  );
}
