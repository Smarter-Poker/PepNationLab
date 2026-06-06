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
import DynamicAddToCartButton from '../storefront/DynamicAddToCartButton';

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

  const isSmall = size === 'sm';

  return (
    <DynamicAddToCartButton
      onClick={handleClick}
      isSmall={isSmall}
      justAdded={justAdded}
    />
  );
}
