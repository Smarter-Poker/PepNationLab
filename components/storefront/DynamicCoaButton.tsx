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
  // Aspect ratio of the new COA button is 1024 / 521 = ~1.965
  const baseWidth = isSmall ? 100 : 140;
  const baseHeight = Math.round(baseWidth / 1.965);
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
          objectFit: 'contain',
          display: 'block',
        }}
        width={1024} height={521} unoptimized />
    </div>
  );
}
