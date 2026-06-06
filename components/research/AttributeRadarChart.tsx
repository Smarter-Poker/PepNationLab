'use client';

/**
 * AttributeRadarChart - Phase 2
 * Full SVG radar with animated entry, hover tooltips showing per-axis score,
 * and percentage labels on the rings. Supports 2–8 compounds, 2–12 axes.
 */

import React, { useState, useRef, useEffect } from 'react';

export interface RadarDataPoint {
  label: string;
  scores: number[]; // 0 to 100
}

interface Props {
  data: RadarDataPoint[];
  colors: string[]; // 1 color per compound
  compoundNames?: string[];
  size?: number;
  animated?: boolean;
}

export default function AttributeRadarChart({
  data,
  colors,
  compoundNames = [],
  size = 280,
  animated = true,
}: Props) {
  const [hoveredAxis, setHoveredAxis] = useState<number | null>(null);
  const [progress, setProgress] = useState(animated ? 0 : 1);
  const rafRef = useRef<number>(0);
  const startRef = useRef<number>(0);

  useEffect(() => {
    if (!data || data.length < 2) return;
    if (!animated) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setProgress(1);
      return;
    }
    setProgress(0);
    const duration = 800;
    const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
    const tick = (now: number) => {
      if (!startRef.current) startRef.current = now;
      const elapsed = now - startRef.current;
      const t = Math.min(elapsed / duration, 1);
      setProgress(easeOut(t));
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [animated, data]);

  if (!data || data.length < 2) return null;

  const center = size / 2;
  const radius = center * 0.65;
  const labelRadius = center * 0.88;
  const numAxes = data.length;
  const angleStep = (Math.PI * 2) / numAxes;

  const getPoint = (score: number, index: number, scaleFactor = 1) => {
    const angle = index * angleStep - Math.PI / 2;
    const distance = (score / 100) * radius * scaleFactor;
    return {
      x: center + Math.cos(angle) * distance,
      y: center + Math.sin(angle) * distance,
    };
  };

  const getLabelPoint = (index: number) => {
    const angle = index * angleStep - Math.PI / 2;
    return {
      x: center + Math.cos(angle) * labelRadius,
      y: center + Math.sin(angle) * labelRadius,
      angle,
    };
  };

  // Background web rings
  const webLevels = [25, 50, 75, 100];
  const webPolygons = webLevels.map((level, li) => {
    const pts = Array.from({ length: numAxes }, (_, i) => {
      const p = getPoint(level, i);
      return `${p.x},${p.y}`;
    }).join(' ');
    return (
      <polygon
        key={`web-${level}`}
        points={pts}
        fill="none"
        stroke={`rgba(255,255,255,${0.04 + li * 0.03})`}
        strokeWidth="1"
      />
    );
  });

  // Ring % labels (on the right-most axis direction)
  const ringLabels = [25, 50, 75].map(level => {
    const p = getPoint(level, 0);
    return (
      <text
        key={`rl-${level}`}
        x={p.x + 3}
        y={p.y}
        fill="rgba(255,255,255,0.2)"
        fontSize="8"
        alignmentBaseline="middle"
      >
        {level}%
      </text>
    );
  });

  // Axes and labels
  const axes = data.map((d, i) => {
    const p100 = getPoint(100, i);
    const lp = getLabelPoint(i);
    const angle = lp.angle;
    const isHovered = hoveredAxis === i;

    let textAnchor: 'start' | 'end' | 'middle' = 'middle';
    const cosA = Math.cos(angle);
    if (Math.abs(cosA) > 0.2) textAnchor = cosA > 0 ? 'start' : 'end';

    // Tooltip position for hover
    const tooltipX = lp.x;
    const tooltipY = lp.y + (Math.sin(angle) > 0 ? 16 : -16);

    return (
      <g key={`axis-${i}`}>
        <line
          x1={center}
          y1={center}
          x2={p100.x}
          y2={p100.y}
          stroke={isHovered ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.12)'}
          strokeWidth={isHovered ? 1.5 : 1}
        />
        {/* Invisible fat hit area for hover */}
        <line
          x1={center}
          y1={center}
          x2={p100.x}
          y2={p100.y}
          stroke="transparent"
          strokeWidth="20"
          style={{ cursor: 'default' }}
          onMouseEnter={() => setHoveredAxis(i)}
          onMouseLeave={() => setHoveredAxis(null)}
        />
        <text
          x={lp.x}
          y={lp.y}
          fill={isHovered ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.55)'}
          fontSize={isHovered ? '11' : '10'}
          fontWeight={isHovered ? '800' : '600'}
          textAnchor={textAnchor}
          alignmentBaseline="middle"
          style={{ transition: 'fill 0.2s, font-size 0.2s' }}
        >
          {d.label}
        </text>

        {/* Hover tooltip with all compound scores for this axis */}
        {isHovered && (
          <g>
            <rect
              x={tooltipX - 70}
              y={tooltipY - 22}
              width="140"
              height={20 + d.scores.length * 14}
              rx="5"
              fill="rgba(10,20,35,0.95)"
              stroke="rgba(255,255,255,0.15)"
              strokeWidth="1"
            />
            <text x={tooltipX} y={tooltipY - 10} textAnchor="middle" fill="rgba(255,255,255,0.9)" fontSize="9" fontWeight="800">
              {d.label}
            </text>
            {d.scores.map((score, ci) => (
              <text
                key={`ht-${ci}`}
                x={tooltipX}
                y={tooltipY + ci * 14}
                textAnchor="middle"
                fill={colors[ci % colors.length]}
                fontSize="9"
                fontWeight="700"
              >
                {compoundNames[ci] ? `${compoundNames[ci].slice(0, 12)}: ${Math.round(score)}` : `C${ci + 1}: ${Math.round(score)}`}
              </text>
            ))}
          </g>
        )}
      </g>
    );
  });

  // Compound polygons - animated
  const numCompounds = data[0].scores.length;
  const polygons = Array.from({ length: numCompounds }, (_, cIdx) => {
    const pts = data.map((d, i) => {
      const score = (d.scores[cIdx] || 0) * progress;
      const p = getPoint(score, i);
      return `${p.x},${p.y}`;
    }).join(' ');

    const color = colors[cIdx % colors.length];
    return (
      <polygon
        key={`comp-${cIdx}`}
        points={pts}
        fill={`${color}22`}
        stroke={color}
        strokeWidth="2"
        style={{ mixBlendMode: 'screen' }}
      />
    );
  });

  // Dot markers at each axis point
  const dots = Array.from({ length: numCompounds }, (_, cIdx) =>
    data.map((d, i) => {
      const score = (d.scores[cIdx] || 0) * progress;
      const p = getPoint(score, i);
      const color = colors[cIdx % colors.length];
      return (
        <circle
          key={`dot-${cIdx}-${i}`}
          cx={p.x}
          cy={p.y}
          r="3"
          fill={color}
          stroke="rgba(0,0,0,0.5)"
          strokeWidth="1"
          opacity={0.9}
        />
      );
    })
  );

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', width: '100%', padding: '8px 0' }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ overflow: 'visible', maxWidth: '100%' }}
      >
        {/* Subtle center glow */}
        <circle cx={center} cy={center} r={radius * 0.15} fill="rgba(0,196,188,0.05)" />
        {webPolygons}
        {ringLabels}
        {axes}
        {polygons}
        {dots}
      </svg>
    </div>
  );
}
