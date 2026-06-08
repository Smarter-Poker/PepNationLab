'use client';

import Image from 'next/image';
import React from 'react';
import { vibrate } from '@/lib/haptics';

interface DynamicAddToCartButtonProps {
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  pendingQty?: number;
  isSmall?: boolean;
  style?: React.CSSProperties;
  justAdded?: boolean;
}

export default function DynamicAddToCartButton({
  onClick,
  disabled = false,
  pendingQty = 0,
  isSmall = false,
  style = {},
  justAdded = false,
}: DynamicAddToCartButtonProps) {
  const [isPressed, setIsPressed] = React.useState(false);

  // Aspect ratio is 896 / 251 = ~3.57
  const baseWidth = isSmall ? 130 : 180;
  const baseHeight = Math.round(baseWidth / 3.57);

  return (
    <button
      type="button"
      onClick={(e) => {
        if (!disabled) {
          vibrate(20);
          onClick(e);
        }
      }}
      disabled={disabled}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      onMouseLeave={() => setIsPressed(false)}
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
        width: baseWidth,
        height: baseHeight,
        opacity: disabled ? 0.5 : 1,
        filter: disabled ? 'grayscale(100%)' : 'none',
        transform: isPressed ? 'scale(0.96)' : 'scale(1)',
        transition: 'transform 0.1s ease, opacity 0.2s',
        flexShrink: 0,
        ...style,
      }}
    >
      <Image
        src="/images/add-to-cart-dynamic.png"
        alt="Add To Cart"
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          display: 'block',
          filter: justAdded ? 'hue-rotate(90deg) brightness(1.2) drop-shadow(0 0 4px #68D391)' : 'none',
        }}
       width={200} height={200} unoptimized />
      {justAdded ? (
        <span
          style={{
            position: 'absolute',
            background: '#68D391',
            color: '#000',
            fontSize: '0.62rem',
            fontWeight: 900,
            borderRadius: '9999px',
            padding: '1px 6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 6px rgba(104, 211, 145, 0.4)',
            border: '1px solid #0a0f14',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
          }}
        >
          ✓ Added
        </span>
      ) : null}
    </button>
  );
}
