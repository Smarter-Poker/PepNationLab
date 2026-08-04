'use client';

import React from 'react';
import Image from 'next/image';

const CATEGORY_COLORS: Record<string, { primary: string; dark: string; vialImg: string; subtitle: string }> = {
  'Weight Loss & Metabolism':    { primary: '#E84040', dark: '#9B1515', vialImg: '/images/vial_weight_loss.png',    subtitle: 'Weight Loss &\nMetabolism' },
  'Muscle Growth & Performance': { primary: '#1B6FE8', dark: '#0D3F8F', vialImg: '/images/vial_muscle_growth.png', subtitle: 'Muscle Growth &\nPerformance' },
  'Healing & Recovery':          { primary: '#00C4BC', dark: '#007A77', vialImg: '/images/vial_healing.png',        subtitle: 'Healing &\nRecovery' },
  'Skin, Hair & Cosmetics':      { primary: '#22A85E', dark: '#14663A', vialImg: '/images/vial_skin_hair.png',      subtitle: 'Skin, Hair &\nCosmetics' },
  'Anti-Aging & Longevity':      { primary: '#D4748A', dark: '#8F3D52', vialImg: '/images/vial_anti_aging.png',     subtitle: 'Anti-Aging &\nLongevity' },
  'Sexual Health & Hormones':    { primary: '#8B44C8', dark: '#5A2882', vialImg: '/images/vial_sexual_health.png',  subtitle: 'Sexual Health &\nHormones' },
  'Growth Hormone Peptides':     { primary: '#D4A017', dark: '#8A6600', vialImg: '/images/vial_growth_hormone.png', subtitle: 'Growth Hormone\nPeptide' },
  'Growth Hormone':              { primary: '#D4A017', dark: '#8A6600', vialImg: '/images/vial_growth_hormone.png', subtitle: 'Growth Hormone\nPeptide' },
  'Nootropics':                  { primary: '#8A8A8A', dark: '#444444', vialImg: '/images/vial_nootropics.png',     subtitle: 'Nootropics\nCognitive' },
};

const FALLBACK_COLOR = { primary: '#00C4BC', dark: '#007A77', vialImg: '/images/vial_healing.png', subtitle: 'Research\nCompound' };

function getCategoryColor(category: string) {
  if (CATEGORY_COLORS[category]) return CATEGORY_COLORS[category];
  const lower = category.toLowerCase();
  if (lower.includes('weight') || lower.includes('metabolism') || lower.includes('glp')) return CATEGORY_COLORS['Weight Loss & Metabolism'];
  if (lower.includes('muscle') || lower.includes('performance')) return CATEGORY_COLORS['Muscle Growth & Performance'];
  if (lower.includes('heal') || lower.includes('recover')) return CATEGORY_COLORS['Healing & Recovery'];
  if (lower.includes('skin') || lower.includes('hair') || lower.includes('cosmetic')) return CATEGORY_COLORS['Skin, Hair & Cosmetics'];
  if (lower.includes('anti-aging') || lower.includes('longev')) return CATEGORY_COLORS['Anti-Aging & Longevity'];
  if (lower.includes('sexual') || lower.includes('hormone')) return CATEGORY_COLORS['Sexual Health & Hormones'];
  if (lower.includes('growth') || lower.includes('sermorelin') || lower.includes('ipamorelin')) return CATEGORY_COLORS['Growth Hormone Peptides'];
  if (lower.includes('nootropic') || lower.includes('cognitive') || lower.includes('brain')) return CATEGORY_COLORS['Nootropics'];
  return FALLBACK_COLOR;
}

function splitName(name: string): [string, string | null] {
  if (name.length <= 14) return [name, null];
  for (const sep of [' And ', ' & ', ' + ']) {
    const idx = name.indexOf(sep);
    if (idx > 0 && idx < name.length - sep.length) {
      return [name.slice(0, idx + sep.length - 1).trim(), name.slice(idx + sep.length).trim()];
    }
  }
  const mid = Math.floor(name.length / 2);
  const spaceAfter = name.indexOf(' ', mid);
  const spaceBefore = name.lastIndexOf(' ', mid);
  const splitAt = spaceAfter !== -1 ? spaceAfter : spaceBefore;
  if (splitAt > 0) return [name.slice(0, splitAt).trim(), name.slice(splitAt + 1).trim()];
  return [name, null];
}

interface PeptideVialCardProps {
  name: string;
  category: string;
  className?: string;
  style?: React.CSSProperties;
}

export default function PeptideVialCard({ name, category, className = '', style }: PeptideVialCardProps) {
  const colors = getCategoryColor(category);
  const [line1, line2] = splitName(name.toUpperCase());
  const subtitleLines = colors.subtitle.split('\n');

  const W = 240, H = 300;
  const LX = 30, LY = 108, LW = W - 60, LH = 140;
  const SH = 8;
  const BX = LX + 12, BY = LY + SH + 12, BW = LW - 24, BH = line2 ? 48 : 34;

  return (
    <div className={className} style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', ...style }}>
      <Image
        src={colors.vialImg}
        alt={name}
        width={300}
        height={400}
        unoptimized
        style={{ width: '100%', height: '100%', objectFit: 'contain', objectPosition: 'center', padding: '4px', transition: 'transform 0.4s ease' }}
        className="store-image-hover"
        onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0'; }}
      />
      <svg viewBox={`0 0 ${W} ${H}`} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }} xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        {/* White label background */}
        <rect x={LX} y={LY} width={LW} height={LH} rx="4" ry="4" fill="white" fillOpacity="0.96" />
        {/* Top stripe */}
        <rect x={LX} y={LY} width={LW} height={SH} rx="2" ry="2" fill={colors.primary} />
        <rect x={LX} y={LY + SH} width={LW} height={2} fill={colors.dark} fillOpacity="0.5" />
        {/* Bottom stripe */}
        <rect x={LX} y={LY + LH - SH} width={LW} height={SH} rx="2" ry="2" fill={colors.primary} />
        <rect x={LX} y={LY + LH - SH - 2} width={LW} height={2} fill={colors.dark} fillOpacity="0.5" />
        {/* Compound badge */}
        <rect x={BX} y={BY} width={BW} height={BH} rx="6" ry="6" fill="#1E1E2C" />
        <text x={BX + BW / 2} y={BY + (line2 ? 18 : 21)} textAnchor="middle" fontFamily="'Inter','Arial',sans-serif" fontWeight="800" fontSize={line2 ? (line1.length > 12 ? 10 : 12) : (line1.length > 12 ? 11 : 13)} fill="white" letterSpacing="0.04em">{line1}</text>
        {line2 && <text x={BX + BW / 2} y={BY + 34} textAnchor="middle" fontFamily="'Inter','Arial',sans-serif" fontWeight="800" fontSize={line2.length > 12 ? 10 : 12} fill="white" letterSpacing="0.04em">{line2}</text>}
        {/* INJECTION type */}
        <text x={LX + LW / 2} y={BY + BH + 18} textAnchor="middle" fontFamily="'Inter','Arial',sans-serif" fontWeight="700" fontSize={11} fill="#1E1E2C" letterSpacing="0.06em">INJECTION</text>
        {/* Category subtitle removed per user request */}
        {/* PN logo */}
        <text x={LX + 10} y={LY + LH - SH - 14} fontFamily="'Inter','Arial Black',sans-serif" fontWeight="900" fontSize={14} fill={colors.primary} letterSpacing="-1">PN</text>
        {/* Brand name */}
        <text x={LX + 32} y={LY + LH - SH - 14} fontFamily="'Inter','Arial',sans-serif" fontWeight="700" fontSize={9.5} fill="#1E1E2C" letterSpacing="0.01em">Pep Nation Lab</text>
      </svg>
    </div>
  );
}
