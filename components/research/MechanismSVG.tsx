/**
 * MechanismSVG -- minimal four-box horizontal flow diagram.
 * Server-safe; pure SVG.
 */

interface Props {
  mechanism: string;
  receptors: string[];
  compoundName?: string;
}

export default function MechanismSVG({ mechanism, receptors, compoundName = 'Compound' }: Props) {
  const target = (receptors && receptors.length > 0 ? receptors.slice(0, 2).join(' / ') : 'Target') || 'Target';
  const downstream = mechanism ? mechanism.split(/\s+/).slice(0, 6).join(' ') : 'Pathway';
  const effect = 'Research Effect';

  const boxes: Array<{ label: string; sub: string }> = [
    { label: compoundName, sub: 'Compound' },
    { label: target, sub: 'Receptor / Target' },
    { label: downstream, sub: 'Downstream Pathway' },
    { label: effect, sub: 'Studied Effect' },
  ];

  const W = 880;
  const H = 200;
  const boxW = 180;
  const boxH = 90;
  const gap = (W - boxW * boxes.length) / (boxes.length - 1);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg" style={{ width: '100%', height: 'auto', maxWidth: 880 }}>
      <defs>
        <marker id="arrowhead" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto">
          <polygon points="0 0, 9 3, 0 6" fill="#00C4BC" />
        </marker>
      </defs>
      {boxes.map((b, i) => {
        const x = i * (boxW + gap);
        const y = (H - boxH) / 2;
        return (
          <g key={i}>
            <rect x={x} y={y} width={boxW} height={boxH} rx={10} ry={10} fill="#162230" stroke="#00C4BC" strokeWidth="1.5" />
            <text x={x + boxW / 2} y={y + 32} textAnchor="middle" fill="#FFFFFF" fontSize="14" fontWeight="700">
              {b.label.length > 22 ? b.label.slice(0, 20) + '...' : b.label}
            </text>
            <text x={x + boxW / 2} y={y + 56} textAnchor="middle" fill="#A8B4C0" fontSize="10" fontWeight="600">
              {b.sub}
            </text>
            {i < boxes.length - 1 && (
              <line
                x1={x + boxW}
                y1={H / 2}
                x2={x + boxW + gap}
                y2={H / 2}
                stroke="#00C4BC"
                strokeWidth="2"
                markerEnd="url(#arrowhead)"
              />
            )}
          </g>
        );
      })}
    </svg>
  );
}
