/**
 * PatentTimeline -- horizontal timeline showing now and expiry.
 */

interface Props {
  patentStatus?: string | null;
  patentExpiryYear?: number | null;
}

export default function PatentTimeline({ patentStatus, patentExpiryYear }: Props) {
  const currentYear = new Date().getFullYear();
  const expiry = patentExpiryYear ?? null;

  if (!patentStatus && !expiry) {
    return (
      <div className="glass-panel" style={{ padding: 16, borderRadius: 12, color: '#A8B4C0', fontSize: 14 }}>
        Patent Status Will Populate Once The Google Patents Sync Cron Runs.
      </div>
    );
  }

  const startYear = currentYear - 5;
  let endYear = expiry ? Math.max(expiry + 2, currentYear + 2) : currentYear + 10;
  if (endYear - startYear < 6) endYear = startYear + 6;

  const span = endYear - startYear;
  const nowPct = ((currentYear - startYear) / span) * 100;
  const expPct = expiry !== null ? ((expiry - startYear) / span) * 100 : null;

  return (
    <div className="glass-panel" style={{ padding: 20, borderRadius: 12 }}>
      <h3 style={{ margin: 0, color: '#FFFFFF', fontSize: 14, fontWeight: 800, marginBottom: 16 }}>Patent Lifecycle</h3>
      <div style={{ position: 'relative', height: 60 }}>
        <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: 2, background: 'rgba(168,180,192,0.3)' }} />
        <div style={{ position: 'absolute', top: 0, left: 0, fontSize: 11, color: '#A8B4C0' }}>{startYear}</div>
        <div style={{ position: 'absolute', top: 0, right: 0, fontSize: 11, color: '#A8B4C0' }}>{endYear}</div>
        <div
          style={{
            position: 'absolute',
            top: '40%',
            left: `${nowPct}%`,
            transform: 'translateX(-50%)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          <span style={{ width: 14, height: 14, borderRadius: '50%', background: '#00C4BC', border: '2px solid #050A0F' }} />
          <span style={{ fontSize: 10, color: '#00C4BC', fontWeight: 700, marginTop: 6, textTransform: 'uppercase' }}>Now ({currentYear})</span>
        </div>
        {expPct !== null && (
          <div
            style={{
              position: 'absolute',
              top: '40%',
              left: `${expPct}%`,
              transform: 'translateX(-50%)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
          >
            <span style={{ width: 14, height: 14, borderRadius: '50%', background: '#E53E3E', border: '2px solid #050A0F' }} />
            <span style={{ fontSize: 10, color: '#E53E3E', fontWeight: 700, marginTop: 6, textTransform: 'uppercase' }}>Expiry ({expiry})</span>
          </div>
        )}
      </div>
      {patentStatus && (
        <p style={{ marginTop: 16, marginBottom: 0, fontSize: 13, color: '#D0DAE4' }}>
          <strong style={{ color: '#FFFFFF' }}>Status:</strong> {patentStatus}
        </p>
      )}
    </div>
  );
}
