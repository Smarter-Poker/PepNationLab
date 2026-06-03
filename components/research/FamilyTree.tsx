/**
 * FamilyTree -- simple SVG family-tree.
 */

interface Props {
  compoundSlug: string;
  analogs: string[];
  parent?: string;
  compoundName?: string;
}

export default function FamilyTree({ compoundSlug, analogs, parent, compoundName }: Props) {
  const center = compoundName ?? compoundSlug;
  const W = 880;
  const rowH = 70;
  const H = parent ? rowH * 3 + 40 : rowH * 2 + 40;
  const centerY = parent ? rowH * 1.5 + 20 : rowH * 0.5 + 20;

  const boxW = 160;
  const boxH = 44;

  const xCenter = W / 2 - boxW / 2;

  return (
    <div className="card-metal" style={{ padding: 16, borderRadius: 12 }}>
      <h3 style={{ margin: 0, color: '#FFFFFF', fontSize: 14, fontWeight: 800, marginBottom: 12 }}>Compound Family Tree</h3>
      <svg viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: 'auto' }}>
        {parent && (
          <g>
            <rect x={xCenter} y={20} width={boxW} height={boxH} rx={8} fill="#1D2D3E" stroke="#A8B4C0" strokeWidth="1.5" />
            <text x={xCenter + boxW / 2} y={48} textAnchor="middle" fill="#A8B4C0" fontSize="13" fontWeight="700">
              {parent.length > 22 ? parent.slice(0, 20) + '...' : parent}
            </text>
            <text x={xCenter + boxW / 2} y={62} textAnchor="middle" fill="#A8B4C0" fontSize="10">
              Parent
            </text>
            <line x1={W / 2} y1={20 + boxH} x2={W / 2} y2={centerY} stroke="#A8B4C0" strokeWidth="1.5" />
          </g>
        )}
        <rect x={xCenter} y={centerY} width={boxW} height={boxH} rx={8} fill="#162230" stroke="#00C4BC" strokeWidth="2" />
        <text x={xCenter + boxW / 2} y={centerY + 28} textAnchor="middle" fill="#FFFFFF" fontSize="14" fontWeight="800">
          {center.length > 22 ? center.slice(0, 20) + '...' : center}
        </text>
        {analogs.length > 0 && (
          <>
            {analogs.slice(0, 5).map((a, i) => {
              const step = W / (Math.min(analogs.length, 5) + 1);
              const ax = (i + 1) * step - boxW / 2;
              const ay = centerY + boxH + 40;
              return (
                <g key={i}>
                  <line x1={xCenter + boxW / 2} y1={centerY + boxH} x2={ax + boxW / 2} y2={ay} stroke="#00C4BC" strokeWidth="1.5" />
                  <rect x={ax} y={ay} width={boxW} height={boxH} rx={8} fill="#1D2D3E" stroke="#00C4BC" strokeWidth="1.5" />
                  <text x={ax + boxW / 2} y={ay + 28} textAnchor="middle" fill="#FFFFFF" fontSize="13" fontWeight="700">
                    {a.length > 22 ? a.slice(0, 20) + '...' : a}
                  </text>
                </g>
              );
            })}
          </>
        )}
      </svg>
    </div>
  );
}
