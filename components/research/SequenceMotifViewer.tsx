/**
 * SequenceMotifViewer -- residues colored by side-chain class.
 */

interface Props {
  sequence: string;
}

const CLASSES: Record<string, { name: string; color: string }> = {
  basic: { name: 'Basic', color: '#3182CE' },
  acidic: { name: 'Acidic', color: '#E53E3E' },
  polar: { name: 'Polar', color: '#38A169' },
  nonpolar: { name: 'Non-Polar', color: '#A8B4C0' },
  aromatic: { name: 'Aromatic', color: '#D69E2E' },
  special: { name: 'Special', color: '#D6BCFA' },
};

function classOf(aa: string): keyof typeof CLASSES {
  const a = aa.toUpperCase();
  if ('KRH'.includes(a)) return 'basic';
  if ('DE'.includes(a)) return 'acidic';
  if ('STNQ'.includes(a)) return 'polar';
  if ('AVLIM'.includes(a)) return 'nonpolar';
  if ('FYW'.includes(a)) return 'aromatic';
  if ('CGP'.includes(a)) return 'special';
  return 'nonpolar';
}

export default function SequenceMotifViewer({ sequence }: Props) {
  if (!sequence) {
    return (
      <div className="card-metal" style={{ padding: 16, borderRadius: 12, color: '#A8B4C0', fontSize: 14 }}>
        No Sequence Available For This Compound.
      </div>
    );
  }
  const clean = sequence.replace(/\s+/g, '').toUpperCase();

  return (
    <div className="card-metal" style={{ padding: 16, borderRadius: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
        <h3 style={{ margin: 0, color: '#FFFFFF', fontSize: 14, fontWeight: 800 }}>Sequence Motif Viewer</h3>
        <span style={{ fontSize: 12, color: '#A8B4C0' }}>{clean.length} Residues</span>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 16 }}>
        {clean.split('').map((aa, i) => {
          const k = classOf(aa);
          const meta = CLASSES[k];
          return (
            <span
              key={i}
              title={`Position ${i + 1}: ${aa} (${meta.name})`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 26,
                height: 26,
                borderRadius: 6,
                background: meta.color,
                color: '#0F1923',
                fontWeight: 800,
                fontSize: 13,
              }}
            >
              {aa}
            </span>
          );
        })}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        {Object.entries(CLASSES).map(([k, v]) => (
          <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#A8B4C0' }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: v.color }} />
            {v.name}
          </span>
        ))}
      </div>
    </div>
  );
}
