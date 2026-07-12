import React from 'react';

export default function Loading() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '60vh',
      gap: '16px'
    }}>
      <div style={{
        width: '40px',
        height: '40px',
        borderRadius: '50%',
        border: '3px solid rgba(192,184,168,0.2)',
        borderTopColor: 'var(--teal)',
        animation: 'rotate-orbit 0.8s linear infinite'
      }} />
      <div style={{
        color: 'var(--silver)',
        fontSize: '0.9rem',
        fontWeight: 500,
        letterSpacing: '0.05em'
      }}>
        LOADING...
      </div>
    </div>
  );
}
