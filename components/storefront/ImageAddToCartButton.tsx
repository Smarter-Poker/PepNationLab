'use client';

import React from 'react';
import Image from 'next/image';
import { vibrate } from '@/lib/haptics';

interface ImageAddToCartButtonProps {
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  style?: React.CSSProperties;
  className?: string;
  width?: number;
}

export default function ImageAddToCartButton({
  onClick,
  disabled = false,
  style = {},
  className = '',
  width = 160,
}: ImageAddToCartButtonProps) {
  const [isPressed, setIsPressed] = React.useState(false);

  return (
    <button
      type="button"
      className={className}
      disabled={disabled}
      onMouseDown={() => !disabled && setIsPressed(true)}
      onMouseUp={() => !disabled && setIsPressed(false)}
      onMouseLeave={() => !disabled && setIsPressed(false)}
      onClick={(e) => {
        if (!disabled) {
          vibrate(20);
          onClick(e);
        }
      }}
      style={{
        ...style,
        background: 'transparent',
        border: 'none',
        padding: 0,
        cursor: disabled ? 'not-allowed' : 'pointer',
        transform: isPressed ? 'scale(0.96)' : 'scale(1)',
        transition: 'transform 0.1s ease',
        width: width,
        height: 'auto',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? 0.5 : 1,
      }}
      aria-label="Add To Cart"
    >
      <Image
        src="/images/storefront/add-to-cart-btn.png"
        alt="Add To Cart"
        width={1024}
        height={512}
        style={{
          width: '100%',
          height: 'auto',
          objectFit: 'contain',
          pointerEvents: 'none',
          filter: 'drop-shadow(0px 4px 12px rgba(0,0,0,0.4))'
        }}
      />
    </button>
  );
}
