/**
 * ConfidenceBand -- small colored chip indicating a fact's confidence level.
 */

interface Props {
  confidence: 'strong' | 'moderate' | 'preliminary' | 'single_report';
  count?: number;
}

const META: Record<Props['confidence'], { label: string; color: string; bg: string }> = {
  strong: { label: 'Strong Evidence', color: '#68D391', bg: 'rgba(104,211,145,0.15)' },
  moderate: { label: 'Moderate Evidence', color: '#00E5FF', bg: 'rgba(0,229,255,0.12)' },
  preliminary: { label: 'Preliminary', color: '#F6AD55', bg: 'rgba(246,173,85,0.14)' },
  single_report: { label: 'Single Report', color: '#E53E3E', bg: 'rgba(229,62,62,0.14)' },
};

export default function ConfidenceBand({ confidence, count }: Props) {
  const m = META[confidence] ?? META.preliminary;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '4px 10px',
        borderRadius: 999,
        background: m.bg,
        color: m.color,
        fontSize: 12,
        fontWeight: 700,
        border: `1px solid ${m.color}`,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
      }}
    >
      {m.label}
      {typeof count === 'number' && <span style={{ opacity: 0.85 }}>{count}</span>}
    </span>
  );
}
