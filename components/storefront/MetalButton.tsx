import React from 'react';

interface MetalButtonProps {
  children: React.ReactNode;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  style?: React.CSSProperties;
  onMouseDown?: () => void;
  onMouseUp?: () => void;
  onMouseLeave?: () => void;
  isPressed?: boolean;
  type?: 'button' | 'submit' | 'reset';
}

export default function MetalButton({
  children,
  onClick,
  disabled = false,
  style = {},
  onMouseDown,
  onMouseUp,
  onMouseLeave,
  isPressed = false,
  type = 'button'
}: MetalButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      onMouseDown={onMouseDown}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseLeave}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '0 16px',
        borderRadius: 9999, // capsule shape like the original COA button
        cursor: disabled ? 'not-allowed' : 'pointer',
        border: '1px solid rgba(190,200,210,0.30)',
        background: 'linear-gradient(180deg, #34424f 0%, #1d2630 55%, #151d26 100%)',
        boxShadow: disabled 
          ? 'none' 
          : 'inset 0 1px 0 rgba(255,255,255,0.22), inset 0 -2px 4px rgba(0,0,0,0.5), 0 4px 12px rgba(0,0,0,0.5)',
        color: '#EAF2F8',
        fontWeight: 700,
        letterSpacing: '0.02em',
        whiteSpace: 'nowrap',
        opacity: disabled ? 0.5 : 1,
        filter: disabled ? 'grayscale(100%)' : 'none',
        transform: isPressed ? 'scale(0.96)' : 'scale(1)',
        transition: 'transform 0.1s ease, opacity 0.2s, filter 0.2s',
        outline: 'none',
        ...style
      }}
    >
      {children}
    </button>
  );
}
