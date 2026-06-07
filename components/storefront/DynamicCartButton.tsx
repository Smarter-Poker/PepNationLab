'use client';

import Image from 'next/image';
import React from 'react';

interface DynamicCartButtonProps {
  type: 'checkout' | 'shopping' | 'clear';
  onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  style?: React.CSSProperties;
  className?: string;
}

export default function DynamicCartButton({
  type,
  onClick,
  disabled = false,
  style = {},
  className = '',
}: DynamicCartButtonProps) {
  const [isPressed, setIsPressed] = React.useState(false);
  const [isHovered, setIsHovered] = React.useState(false);

  // Aspect ratio is 805 / 96 = ~8.385
  const imageSrc = {
    checkout: '/images/checkout-btn.png',
    shopping: '/images/shopping-btn.png',
    clear: '/images/clear-btn.png',
  }[type];

  const altText = {
    checkout: 'Go To Checkout',
    shopping: 'Keep Shopping',
    clear: 'Clear Cart',
  }[type];

  // Glow shadow colors matching button themes
  const glowColor = {
    checkout: 'rgba(0, 229, 255, 0.25)',
    shopping: 'rgba(255, 255, 255, 0.15)',
    clear: 'rgba(229, 62, 62, 0.25)',
  }[type];

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
        width: '100%',
        aspectRatio: '805 / 96',
        opacity: disabled ? 0.45 : 1,
        transform: isPressed ? 'scale(0.97)' : isHovered ? 'scale(1.01)' : 'scale(1)',
        filter: isHovered && !disabled
          ? `brightness(1.08) drop-shadow(0 4px 12px ${glowColor})`
          : 'none',
        transition: 'transform 0.15s cubic-bezier(0.16, 1, 0.3, 1), filter 0.2s ease, opacity 0.2s',
        flexShrink: 0,
        ...style,
      }}
    >
      <Image
        src={imageSrc}
        alt={altText}
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
