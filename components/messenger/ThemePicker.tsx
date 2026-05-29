'use client';
import { useState } from 'react';
import { THEME_VALUES, type ThemeValue } from '@/lib/messenger/schemas';
import { toast } from 'sonner';

interface Props {
  conversationId: string;
  currentTheme: ThemeValue | null;
  onChange: (next: ThemeValue) => void;
}

const THEME_SWATCHES: Record<ThemeValue, { label: string; color: string }> = {
  default: { label: 'Default', color: '#1D2D3E' },
  teal: { label: 'Teal', color: '#00C4BC' },
  indigo: { label: 'Indigo', color: '#6366F1' },
  rose: { label: 'Rose', color: '#E11D48' },
  amber: { label: 'Amber', color: '#F59E0B' },
  slate: { label: 'Slate', color: '#64748B' },
};

export default function ThemePicker({ conversationId, currentTheme, onChange }: Props) {
  const [busy, setBusy] = useState<ThemeValue | null>(null);

  const pick = async (next: ThemeValue) => {
    if (busy) return;
    setBusy(next);
    try {
      const res = await fetch('/api/messenger/set-theme', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ conversationId, themeValue: next }),
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        toast(json.error ?? 'Could Not Update Theme');
        return;
      }
      onChange(next);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }} aria-label="Pick A Theme">
      {THEME_VALUES.map((value) => {
        const swatch = THEME_SWATCHES[value];
        const selected = (currentTheme ?? 'default') === value;
        return (
          <button
            key={value}
            type="button"
            onClick={() => void pick(value)}
            aria-label={`Theme ${swatch.label}`}
            aria-pressed={selected}
            disabled={busy !== null && busy !== value}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 10px',
              borderRadius: 8,
              border: selected ? '2px solid var(--teal, #00C4BC)' : '1px solid var(--surface-3, #1D2D3E)',
              background: 'var(--surface-1, #0F1923)',
              color: 'var(--white, #FFFFFF)',
              cursor: busy ? 'wait' : 'pointer',
              fontWeight: 600,
              fontSize: '0.82rem',
            }}
          >
            <span
              aria-hidden="true"
              style={{
                display: 'inline-block',
                width: 14,
                height: 14,
                borderRadius: 999,
                background: swatch.color,
                border: '1px solid rgba(255,255,255,0.2)',
              }}
            />
            <span>{swatch.label}</span>
          </button>
        );
      })}
    </div>
  );
}
