'use client';

// Unicode escape sequences only -- no literal emoji bytes in source.
const QUICK = [
  '\u{1F44D}', '\u{2764}\u{FE0F}', '\u{1F602}', '\u{1F525}',
  '\u{1F44F}', '\u{1F389}', '\u{1F914}', '\u{1F44E}',
];

interface Props {
  onPick: (emoji: string) => void;
  onClose: () => void;
}

export default function ReactionPopover({ onPick, onClose }: Props) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Pick A Reaction"
      style={{
        position: 'absolute',
        top: '-44px',
        left: 0,
        display: 'flex',
        gap: 4,
        background: 'var(--surface-3, #1D2D3E)',
        padding: 4,
        borderRadius: 24,
        boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
        zIndex: 10,
      }}
    >
      {QUICK.map((e) => (
        <button
          key={e}
          type="button"
          onClick={() => {
            onPick(e);
            onClose();
          }}
          style={{
            background: 'transparent',
            border: 0,
            cursor: 'pointer',
            padding: 4,
            borderRadius: 14,
            fontSize: '1.2rem',
            lineHeight: 1,
          }}
          aria-label={`React With ${e}`}
        >
          {e}
        </button>
      ))}
    </div>
  );
}
