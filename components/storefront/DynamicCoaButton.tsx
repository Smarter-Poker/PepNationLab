'use client';

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
        borderRadius: '9999px',
        background: 'linear-gradient(180deg, #2A303A 0%, #11151A 100%)',
        boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.2), 0 4px 10px rgba(0,0,0,0.4)',
        border: '1px solid rgba(139,147,158,0.3)',
        color: '#FFFFFF',
        fontSize: baseHeight * 0.35,
        fontWeight: 800,
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
        cursor: 'pointer',
        transform: isPressed ? 'scale(0.96)' : 'scale(1)',
        transition: 'transform 0.1s ease',
        ...style,
      }}
    >
      COA
    </div>
  );
}
