/**
 * WadaTimeline -- horizontal year-axis with status pills per year.
 */

interface Entry {
  year: number;
  status: string;
  notes?: string | null;
}

interface Props {
  history: Entry[];
}

function colorForStatus(s: string): string {
  const lower = s.toLowerCase();
  if (lower.includes('prohibit')) return '#E53E3E';
  if (lower.includes('monitor')) return '#F6AD55';
  if (lower.includes('permit')) return '#68D391';
  return '#A8B4C0';
}

export default function WadaTimeline({ history }: Props) {
  if (!history || history.length === 0) {
    return (
      <div className="glass-panel" style={{ padding: 16, borderRadius: 12, color: '#A8B4C0', fontSize: 14 }}>
        No WADA Prohibition History Recorded.
      </div>
    );
  }

  const sorted = [...history].sort((a, b) => a.year - b.year);
  const minYear = sorted[0].year;
  const maxYear = sorted[sorted.length - 1].year;
  const yearSpan = Math.max(1, maxYear - minYear);

  return (
    <div className="glass-panel" style={{ padding: 20, borderRadius: 12 }}>
      <h3 style={{ margin: 0, color: '#FFFFFF', fontSize: 14, fontWeight: 800, marginBottom: 16 }}>WADA Status Timeline</h3>
      <div style={{ position: 'relative', height: 60, marginBottom: 16 }}>
        <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 2, background: 'rgba(168,180,192,0.3)' }} />
        {sorted.map((e, i) => {
          const pct = ((e.year - minYear) / yearSpan) * 100;
          const color = colorForStatus(e.status);
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                top: 0,
                left: `${pct}%`,
                transform: 'translateX(-50%)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4,
              }}
              title={e.notes ?? ''}
            >
              <span style={{ fontSize: 11, color: '#A8B4C0', fontWeight: 700 }}>{e.year}</span>
              <span
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: '50%',
                  background: color,
                  border: '2px solid #050A0F',
                  marginTop: 8,
                }}
              />
              <span style={{ fontSize: 10, color, fontWeight: 700, textTransform: 'uppercase' }}>{e.status}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
