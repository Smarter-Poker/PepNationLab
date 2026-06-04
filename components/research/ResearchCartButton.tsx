'use client';

/**
 * ResearchCartButton — dispatches the `pnl:add-to-cart-by-name` custom event
 * that the StorefrontCompareDrawer and agent storefronts listen to. Allows
 * researchers to add a compound to their active cart directly from any Research
 * Library page without needing to navigate to the store.
 *
 * Falls back gracefully when no productName is available.
 */

import { useState, useCallback } from 'react';
import { ShoppingCart, Check } from 'lucide-react';

interface Props {
  productName: string;
  compoundName?: string;
  size?: 'sm' | 'md';
}

function dispatchAddToCart(productName: string) {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent('pnl:add-to-cart-by-name', {
      detail: { name: productName },
    }));
  } catch { /* ignore */ }
}

export default function ResearchCartButton({ productName, compoundName, size = 'md' }: Props) {
  const [justAdded, setJustAdded] = useState(false);

  const handleClick = useCallback(() => {
    dispatchAddToCart(productName);
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 2000);
  }, [productName]);

  const teal = '#00C4BC';
  const isSmall = size === 'sm';
  const label = compoundName ?? productName;

  return (
    <button
      type="button"
      onClick={handleClick}
      title={`Add ${label} to cart`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: isSmall ? 4 : 6,
        padding: isSmall ? '5px 10px' : '8px 14px',
        borderRadius: isSmall ? 7 : 9,
        border: justAdded ? `1px solid ${teal}` : '1px solid rgba(0,196,188,0.35)',
        background: justAdded ? `${teal}20` : `${teal}10`,
        color: teal,
        fontSize: isSmall ? '0.72rem' : '0.82rem',
        fontWeight: 700,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        transition: 'all 0.2s',
      }}
    >
      {justAdded ? <Check size={isSmall ? 11 : 13} /> : <ShoppingCart size={isSmall ? 11 : 13} />}
      {justAdded ? 'Added!' : isSmall ? 'Add to Cart' : 'Add to Cart'}
    </button>
  );
}
