'use client';

import React from 'react';

interface DynamicCompareButtonProps {
  type: 'compare' | 'collapse' | 'clear' | 'expand';
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  style?: React.CSSProperties;
  className?: string;
  height?: number;
}

export default function DynamicCompareButton({
  type,
  onClick,
  disabled = false,
  style = {},
  className = '',
  height = 36,
}: DynamicCompareButtonProps) {
  const [isPressed, setIsPressed] = React.useState(false);
  const [isHovered, setIsHovered] = React.useState(false);

  // Map types to images and aspect ratios:
  // compare: size (308, 81), ratio = 3.802
  // collapse: size (185, 81), ratio = 2.284
  // clear: size (182, 81), ratio = 2.247
  // expand: size (183, 80), ratio = 2.288
  const buttonConfig = {
    compare: { src: '/images/compare-btn.png', ratio: 3.802, alt: 'Compare Attributes', glow: 'rgba(0, 229, 255, 0.2)' },
    collapse: { src: '/images/collapse-btn.png', ratio: 2.284, alt: 'Collapse', glow: 'rgba(255, 255, 255, 0.15)' },
    clear: { src: '/images/clear-all-btn.png', ratio: 2.247, alt: 'Clear All', glow: 'rgba(229, 62, 62, 0.25)' },
    expand: { src: '/images/expand-btn.png', ratio: 2.288, alt: 'Expand', glow: 'rgba(255, 255, 255, 0.15)' },
  }[type];

  const width = Math.round(height * buttonConfig.ratio);

  return (
    <button
      type="button"
      onClick={(e) => {
        if (!disabled) onClick(e);
      }}
      disabled={disabled}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      onMouseLeave={() => {
        setIsPressed(false);
        setIsHovered(false);
      }}
      onMouseEnter={() => setIsHovered(true)}
      className={className}
      style={{
        background: 'none',
        border: 'none',
        padding: 0,
        margin: 0,
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        outline: 'none',
        width,
        height,
        opacity: disabled ? 0.45 : 1,
        transform: isPressed ? 'scale(0.97)' : isHovered ? 'scale(1.02)' : 'scale(1)',
        filter: isHovered && !disabled
          ? `brightness(1.08) drop-shadow(0 4px 10px ${buttonConfig.glow})`
          : 'none',
        transition: 'transform 0.15s cubic-bezier(0.16, 1, 0.3, 1), filter 0.2s ease, opacity 0.2s',
        flexShrink: 0,
        ...style,
      }}
    >
      <img
        src={buttonConfig.src}
        alt={buttonConfig.alt}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          display: 'block',
        }}
      />
    </button>
  );
}
