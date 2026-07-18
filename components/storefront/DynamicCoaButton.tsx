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
  // We intentionally use the AddToCart button aspect ratio to ensure EXACT same footprint size globally
  // Aspect ratio is 896 / 251 = ~3.57
  const baseWidth = isSmall ? 130 : 180;
  const baseHeight = Math.round(baseWidth / 3.57);

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        width: baseWidth,
        height: baseHeight,
        flexShrink: 0,
        ...style,
      }}
    >
      <Image
        src="/images/coa-button.png"
        alt="Certificate of Analysis"
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'fill',
          display: 'block',
        }}
       width={200} height={200} unoptimized />
    </div>
  );
}
