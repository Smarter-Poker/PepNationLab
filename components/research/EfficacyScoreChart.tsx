'use client';

/**
 * EfficacyScoreChart — renders the efficacy_scores JSON object as an
 * animated, ranked horizontal bar chart with color-coded tiers.
 *
 * Scores 80-100 → teal (strong)
 * Scores 60-79  → amber (moderate)
 * Scores 40-59  → orange (limited)
 * Scores < 40   → red (minimal)
 *
 * Used on individual compound monograph pages AND in the Compare Tool.
 */

import { useEffect, useRef, useState } from 'react';

interface Props {
  scores: Record<string, number>;
  /** Optional heading override */
  title?: string;
  /** Compact mode for embedding inside comparison cells */
  compact?: boolean;
  /** Accent color for the "best" bar highlight */
  accentColor?: string;
}

function humanizeKey(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function scoreColor(v: number): string {
  if (v >= 85) return '#68D391';
  if (v >= 70) return '#00C4BC';
  if (v >= 55) return '#F6AD55';
  return '#FC8181';
}

function scoreTier(v: number): string {
  if (v >= 90) return 'Exceptional';
  if (v >= 80) return 'Strong';
  if (v >= 70) return 'Good';
  if (v >= 55) return 'Moderate';
  return 'Limited';
}

function AnimatedBar({ value, color, delay = 0 }: { value: number; color: string; delay?: number }) {
  const [width, setWidth] = useState(0);
  const rafRef = useRef<ReturnType<typeof requestAnimationFrame>>(0);

  useEffect(() => {
    const timer = setTimeout(() => {
      const duration = 700;
      const start = performance.now();
      const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
      const tick = (now: number) => {
        const elapsed = now - start;
        const t = Math.min(elapsed / duration, 1);
        setWidth(Math.round(easeOut(t) * value));
        if (t < 1) rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    }, delay);
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(rafRef.current);
    };
  }, [value, delay]);

  return (
    <div style={{
      flex: 1,
      height: 8,
      background: 'rgba(255,255,255,0.06)',
      borderRadius: 999,
      overflow: 'hidden',
    }}>
      <div style={{
        height: '100%',
        width: `${width}%`,
        background: `linear-gradient(90deg, ${color}CC, ${color})`,
        borderRadius: 999,
        transition: 'width 0.05s linear',
      }} />
    </div>
  );
}

export default function EfficacyScoreChart({ scores, title, compact = false, accentColor = '#00C4BC' }: Props) {
  const entries = Object.entries(scores ?? {})
    .filter(([, v]) => typeof v === 'number' && !isNaN(v))
    .sort(([, a], [, b]) => b - a);

  if (!entries.length) return null;

  const topScore = entries[0]?.[1] ?? 0;

  if (compact) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {entries.slice(0, 5).map(([key, val], i) => {
          const color = scoreColor(val);
          return (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.5)', minWidth: 90, textTransform: 'capitalize' }}>
                {humanizeKey(key)}
              </span>
              <AnimatedBar value={val} color={color} delay={i * 60} />
              <span style={{ fontSize: '0.62rem', fontWeight: 800, color, minWidth: 22, textAlign: 'right' }}>{val}</span>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(0,196,188,0.04), rgba(255,255,255,0.02))',
      border: '1px solid rgba(0,196,188,0.15)',
      borderRadius: 14,
      padding: '20px 22px',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: accentColor, marginBottom: 3 }}>
            📊 {title ?? 'Research Efficacy Profile'}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.35)' }}>
            Per-domain scores (0–100) based on compound metadata · {entries.length} application areas
          </div>
        </div>
        {/* Top score badge */}
        <div style={{
          textAlign: 'center',
          background: `${scoreColor(topScore)}15`,
          border: `1px solid ${scoreColor(topScore)}40`,
          borderRadius: 10,
          padding: '8px 14px',
          flexShrink: 0,
        }}>
          <div style={{ fontSize: '1.4rem', fontWeight: 900, color: scoreColor(topScore), lineHeight: 1 }}>{topScore}</div>
          <div style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.4)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Peak Score</div>
        </div>
      </div>

      {/* Bars */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {entries.map(([key, val], i) => {
          const color = scoreColor(val);
          const isTop = val === topScore && i === 0;
          return (
            <div key={key} style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: isTop ? '6px 8px' : '3px 0',
              borderRadius: isTop ? 8 : 0,
              background: isTop ? `${color}08` : 'transparent',
              border: isTop ? `1px solid ${color}20` : '1px solid transparent',
              transition: 'background 0.3s',
            }}>
              {/* Rank */}
              <span style={{
                fontSize: '0.6rem',
                fontWeight: 800,
                color: i === 0 ? color : 'rgba(255,255,255,0.2)',
                minWidth: 16,
                textAlign: 'center',
              }}>
                {i === 0 ? '★' : `#${i + 1}`}
              </span>

              {/* Label */}
              <span style={{
                fontSize: '0.8rem',
                fontWeight: isTop ? 800 : 600,
                color: isTop ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.65)',
                minWidth: 160,
                textTransform: 'capitalize',
              }}>
                {humanizeKey(key)}
              </span>

              {/* Bar */}
              <AnimatedBar value={val} color={color} delay={i * 50} />

              {/* Score + Tier */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 90, justifyContent: 'flex-end' }}>
                <span style={{ fontSize: '0.88rem', fontWeight: 900, color }}>{val}</span>
                <span style={{
                  fontSize: '0.6rem',
                  fontWeight: 700,
                  color,
                  background: `${color}15`,
                  border: `1px solid ${color}30`,
                  padding: '1px 5px',
                  borderRadius: 4,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}>
                  {scoreTier(val)}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div style={{
        display: 'flex',
        gap: 12,
        marginTop: 16,
        paddingTop: 12,
        borderTop: '1px solid rgba(255,255,255,0.06)',
        flexWrap: 'wrap',
      }}>
        {[
          { color: '#68D391', label: '85–100: Exceptional' },
          { color: '#00C4BC', label: '70–84: Strong' },
          { color: '#F6AD55', label: '55–69: Moderate' },
          { color: '#FC8181', label: '<55: Limited' },
        ].map(({ color, label }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: color }} />
            <span style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.35)', fontWeight: 600 }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
