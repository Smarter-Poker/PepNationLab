'use client';

import React from 'react';
import MetalButton from './MetalButton';

interface DynamicCoaButtonProps {
  isSmall?: boolean;
  style?: React.CSSProperties;
}

export default function DynamicCoaButton({
  isSmall = false,
  style = {},
}: DynamicCoaButtonProps) {
  const [isPressed, setIsPressed] = React.useState(false);

  return (
    <MetalButton
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      onMouseLeave={() => setIsPressed(false)}
      isPressed={isPressed}
      style={{
        ...style,
      }}
    >
      COA
    </MetalButton>
  );
}
