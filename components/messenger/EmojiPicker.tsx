'use client';

const EMOJI_QUICK = [
  '\u{1F44D}', '\u{2764}\u{FE0F}', '\u{1F602}', '\u{1F525}', '\u{1F44C}', '\u{2705}',
  '\u{1F44F}', '\u{1F64F}', '\u{1F4AF}', '\u{1F389}', '\u{1F60D}', '\u{1F914}',
  '\u{1F622}', '\u{1F62E}', '\u{1F44E}', '\u{1F4B0}', '\u{1F4CE}', '\u{2B50}',
  '\u{1F680}', '\u{1F4AA}', '\u{1F60E}', '\u{1F91D}', '\u{2728}', '\u{1F48E}',
  '\u{1F970}', '\u{1F60A}', '\u{1F923}', '\u{1F44B}', '\u{1F4DA}', '\u{1F37B}',
];

interface Props {
  onPick: (emoji: string) => void;
  onClose: () => void;
}

export default function EmojiPicker({ onPick, onClose }: Props) {
  return (
    <div
      role="dialog"
      aria-label="Pick An Emoji"
      style={{
        position: 'absolute',
        bottom: 56,
        left: 8,
        background: 'var(--surface-2, #162230)',
        border: '1px solid var(--surface-3, #1D2D3E)',
        borderRadius: 10,
        padding: 8,
        boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
        display: 'grid',
        gridTemplateColumns: 'repeat(6, 1fr)',
        gap: 4,
        zIndex: 50,
      }}
    >
      {EMOJI_QUICK.map((e) => (
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
            padding: 6,
            borderRadius: 6,
            fontSize: '1.25rem',
            lineHeight: 1,
          }}
          aria-label={`Insert ${e}`}
        >
          {e}
        </button>
      ))}
    </div>
  );
}
