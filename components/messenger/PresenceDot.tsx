'use client';

interface Props {
  online: boolean;
  size?: number;
}

export default function PresenceDot({ online, size = 10 }: Props) {
  return (
    <span
      aria-label={online ? 'Online' : 'Offline'}
      title={online ? 'Online' : 'Offline'}
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        borderRadius: '50%',
        background: online ? '#3BD16F' : 'var(--grey-400, #A8B4C0)',
        boxShadow: online ? '0 0 0 2px var(--surface-1, #0F1923)' : 'none',
        flexShrink: 0,
      }}
    />
  );
}
