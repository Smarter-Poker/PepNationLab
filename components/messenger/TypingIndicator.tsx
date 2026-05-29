'use client';

interface Props {
  typingUserIds: string[];
}

export default function TypingIndicator({ typingUserIds }: Props) {
  if (typingUserIds.length === 0) return null;
  const label = typingUserIds.length === 1 ? 'Someone Is Typing' : 'Several People Are Typing';
  return (
    <div
      aria-live="polite"
      style={{
        padding: '6px 16px',
        fontSize: '0.78rem',
        color: 'var(--grey-400, #A8B4C0)',
        fontStyle: 'italic',
      }}
    >
      {label}
    </div>
  );
}
