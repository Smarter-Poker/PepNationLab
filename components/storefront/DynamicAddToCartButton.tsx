'use client';

import React from 'react';
import { vibrate } from '@/lib/haptics';
import MetalButton from './MetalButton';
import { ShoppingCart } from 'lucide-react';

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

  return (
    <MetalButton
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
      isPressed={isPressed}
      style={{
        ...style,
        position: 'relative',
        filter: justAdded ? 'hue-rotate(90deg) brightness(1.2) drop-shadow(0 0 4px #68D391)' : 'none',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <ShoppingCart size={16} />
        <span>Add To Cart</span>
      </div>
      
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
            top: -12,
            right: -12,
            zIndex: 10,
          }}
        >
          {pendingQty > 0 ? `+${pendingQty} Added` : 'Added'}
        </span>
      ) : null}
    </MetalButton>
  );
}
