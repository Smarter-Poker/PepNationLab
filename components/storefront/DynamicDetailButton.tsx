'use client';

import React from 'react';

interface DynamicDetailButtonProps {
  type: 'bulk' | 'close';
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  style?: React.CSSProperties;
  className?: string;
  height?: number;
}

export default function DynamicDetailButton({
  type,
  onClick,
  disabled = false,
  style = {},
  className = '',
  height,
}: DynamicDetailButtonProps) {
  const [isPressed, setIsPressed] = React.useState(false);
  const [isHovered, setIsHovered] = React.useState(false);

  // bulk: size (936, 200), ratio = 4.680
  // close: size (571, 149), ratio = 3.832
  const config = {
    bulk: {
      src: '/images/bulk-pricing-btn.png',
      ratio: 4.680,
      alt: 'See Bulk Pricing',
      defaultHeight: 38,
    },
    close: {
      src: '/images/close-details-btn.png',
      ratio: 3.832,
      alt: 'Close',
      defaultHeight: 46,
    },
  }[type];

  const btnHeight = height || config.defaultHeight;
  const btnWidth = Math.round(btnHeight * config.ratio);

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
        width: btnWidth,
        height: btnHeight,
        maxWidth: '100%',
        opacity: disabled ? 0.45 : 1,
        transform: isPressed ? 'scale(0.96)' : isHovered ? 'scale(1.02)' : 'scale(1)',
        filter: isHovered && !disabled
          ? 'brightness(1.08) drop-shadow(0 4px 10px rgba(255, 255, 255, 0.15))'
          : 'none',
        transition: 'transform 0.15s cubic-bezier(0.16, 1, 0.3, 1), filter 0.2s ease, opacity 0.2s',
        flexShrink: 0,
        ...style,
      }}
    >
      <Image
        src={config.src}
        alt={config.alt}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          display: 'block',
        }}
       width={200} height={200} unoptimized />
    </button>
  );
}
