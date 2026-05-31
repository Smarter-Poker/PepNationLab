'use client';

interface Props {
  typingUserIds: string[];
}

export default function TypingIndicator({ typingUserIds }: Props) {
  if (typingUserIds.length === 0) return null;

  return (
    <div style={{ padding: '4px 16px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{
        background: 'var(--surface-2, #162230)',
        padding: '10px 14px',
        borderRadius: 20,
        borderBottomLeftRadius: 4,
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
      }}>
        <div className="typing-dot" style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--grey-400, #A8B4C0)' }} />
        <div className="typing-dot" style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--grey-400, #A8B4C0)', animationDelay: '0.2s' }} />
        <div className="typing-dot" style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--grey-400, #A8B4C0)', animationDelay: '0.4s' }} />
      </div>
      <style>{`
        @keyframes typingBounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.6; }
          30% { transform: translateY(-4px); opacity: 1; }
        }
        .typing-dot {
          animation: typingBounce 1.4s infinite ease-in-out both;
        }
      `}</style>
    </div>
  );
}
