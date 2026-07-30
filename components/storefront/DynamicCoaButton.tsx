'use client';

import Image from 'next/image';
import React from 'react';

interface DynamicCoaButtonProps {
  isSmall?: boolean;
  style?: React.CSSProperties;
}

export default function DynamicCoaButton({
  isSmall = false,
  style = {},
}: DynamicCoaButtonProps) {
  // Use the exact same footprint logic as Add To Cart container
  // Aspect ratio is 896 / 251 = ~3.57 (to ensure 100% size parity globally)
  const baseWidth = isSmall ? 130 : 180;
  const baseHeight = Math.round(baseWidth / 3.57);
  const [isPressed, setIsPressed] = React.useState(false);

  return (
    <div
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      onMouseLeave={() => setIsPressed(false)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        width: baseWidth,
        height: baseHeight,
        flexShrink: 0,
        transform: isPressed ? 'scale(0.96)' : 'scale(1)',
        transition: 'transform 0.1s ease',
        cursor: 'pointer',
        ...style,
      }}
    >
      <Image
        src="/images/coa-button.png"
        alt="Certificate of Analysis"
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover', // cover scales it up to fill the 122px width, preserving aspect ratio and clipping the transparent top/bottom padding
          display: 'block',
        }}
        width={896} height={251} unoptimized />
    </div>
  );
}
