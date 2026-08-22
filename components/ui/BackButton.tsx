"use client";

import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

interface BackButtonProps {
  label?: string;
}

export default function BackButton({ label = 'Back' }: BackButtonProps) {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => router.back()}
      className="hover-lift"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        color: 'var(--teal)',
        fontSize: '0.85rem',
        textDecoration: 'none',
        background: 'transparent',
        border: 'none',
        padding: 0,
        cursor: 'pointer',
        fontFamily: 'inherit',
      }}
    >
      <ArrowLeft size={16} /> {label}
    </button>
  );
}
