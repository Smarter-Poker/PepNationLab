'use client';

import React from 'react';

export interface RadarDataPoint {
  label: string;
  scores: number[]; // 0 to 100
}

interface Props {
  data: RadarDataPoint[];
  colors: string[]; // 1 color per compound
  size?: number;
}

export default function AttributeRadarChart({ data, colors, size = 180 }: Props) {
  if (!data || data.length < 3) return null;

  const center = size / 2;
  const radius = center * 0.75;
  const angleStep = (Math.PI * 2) / data.length;

  const getPoint = (score: number, index: number) => {
    const angle = index * angleStep - Math.PI / 2;
    const distance = (score / 100) * radius;
    return {
      x: center + Math.cos(angle) * distance,
      y: center + Math.sin(angle) * distance,
    };
  };

  // Generate background web
  const webLevels = [25, 50, 75, 100];
  const webPolygons = webLevels.map((level) => {
    const points = data.map((_, i) => {
      const p = getPoint(level, i);
      return `${p.x},${p.y}`;
    }).join(' ');
    return <polygon key={level} points={points} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />;
  });

  // Generate axes and labels
  const axes = data.map((d, i) => {
    const p100 = getPoint(100, i);
    const labelP = getPoint(125, i);
    
    // adjust text anchor based on angle
    const angle = i * angleStep - Math.PI / 2;
    let textAnchor = 'middle';
    if (Math.abs(Math.cos(angle)) > 0.1) {
      textAnchor = Math.cos(angle) > 0 ? 'start' : 'end';
    }

    return (
      <g key={`axis-${i}`}>
        <line x1={center} y1={center} x2={p100.x} y2={p100.y} stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
        <text 
          x={labelP.x} 
          y={labelP.y} 
          fill="rgba(255,255,255,0.6)" 
          fontSize="11" 
          fontWeight="600" 
          textAnchor={textAnchor}
          alignmentBaseline="middle"
        >
          {d.label}
        </text>
      </g>
    );
  });

  // Generate polygons for each compound
  const numCompounds = data[0].scores.length;
  const polygons = [];
  for (let cIdx = 0; cIdx < numCompounds; cIdx++) {
    const points = data.map((d, i) => {
      const p = getPoint(d.scores[cIdx] || 0, i);
      return `${p.x},${p.y}`;
    }).join(' ');
    
    const color = colors[cIdx % colors.length];
    polygons.push(
      <polygon 
        key={`comp-${cIdx}`} 
        points={points} 
        fill={`${color}33`} // 20% opacity
        stroke={color} 
        strokeWidth="2"
        style={{ mixBlendMode: 'screen', transition: 'all 0.3s ease' }}
      />
    );
  }

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%', padding: '20px 0' }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ overflow: 'visible' }}>
        {webPolygons}
        {axes}
        {polygons}
      </svg>
    </div>
  );
}
