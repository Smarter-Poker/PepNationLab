/**
 * EvidenceBadge — pure presentational pill showing a compound's evidence tier.
 * Color and label derive from `evidenceTier()` in the shared lib.
 */
import { evidenceTier } from '@/lib/compounds';

export default function EvidenceBadge({ tier, size = 'md' }: { tier: string; size?: 'sm' | 'md' }) {
  const meta = evidenceTier(tier);
  const pad = size === 'sm' ? '2px 8px' : '4px 12px';
  const fontSize = size === 'sm' ? '0.7rem' : '0.8rem';
  return (
    <span
      title={meta.blurb}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: pad,
        fontSize,
        fontWeight: 700,
        letterSpacing: '0.02em',
        borderRadius: 'var(--radius-md)',
        color: meta.color,
        border: `1px solid ${meta.color}`,
        background: `${meta.color}1A`,
        whiteSpace: 'nowrap',
      }}
    >
      {meta.label}
    </span>
  );
}
