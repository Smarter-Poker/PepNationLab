'use client';

/**
 * PinToCompareButton - writes a compound to the `pnl:compare` localStorage
 * key shared with StorefrontCompareDrawer. Pin from anywhere in the Research
 * Library and the bottom compare drawer activates automatically.
 *
 * Props:
 *   compoundSlug   - the compound's slug (used as compoundSlug in pinned items)
 *   compoundName   - display name
 *   evidenceTierKey - optional tier key for the score engine
 *   productName    - optional product name (falls back to compoundName)
 *   imageUrl       - optional product image url
 *   pricePerVialDollars - optional price
 */

import Image from 'next/image';
import { useState, useEffect, useCallback } from 'react';
import { GitCompare, Check, X } from 'lucide-react';
import { toast } from 'sonner';

const STORAGE_KEY = 'pnl:compare';
const MAX_PINNED = 4;

interface PinnedItem {
  productName: string;
  imageUrl: string | null;
  pricePerVialDollars: number | null;
  compoundSlug: string | null;
  evidenceTierKey: string | null;
  category?: string | null;
  pinnedAt: number;
}

function readPinned(): PinnedItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY) || '[]';
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list.slice(-MAX_PINNED) : [];
  } catch { return []; }
}

function writePinned(list: PinnedItem[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(-MAX_PINNED)));
    // Notify StorefrontCompareDrawer across the page
    window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY }));
    window.dispatchEvent(new CustomEvent('pnl:compare-changed'));
  } catch { /* ignore */ }
}

interface Props {
  compoundSlug: string;
  compoundName: string;
  evidenceTierKey?: string;
  productName?: string;
  imageUrl?: string | null;
  pricePerVialDollars?: number | null;
  category?: string | null;
  size?: 'sm' | 'md';
  className?: string;
  style?: React.CSSProperties;
}

export default function PinToCompareButton({
  compoundSlug,
  compoundName,
  evidenceTierKey,
  productName,
  imageUrl,
  pricePerVialDollars,
  category,
  size = 'md',
  style = {},
}: Props) {
  const [pinned, setPinned] = useState(false);
  const [full, setFull] = useState(false);

  const sync = useCallback(() => {
    const list = readPinned();
    const isPinned = list.some(p => p.compoundSlug === compoundSlug);
    const isFull = list.length >= MAX_PINNED && !isPinned;
    setPinned(isPinned);
    setFull(isFull);
  }, [compoundSlug]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    sync();
    window.addEventListener('pnl:compare-changed', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('pnl:compare-changed', sync);
      window.removeEventListener('storage', sync);
    };
  }, [sync]);

  const toggle = useCallback(() => {
    const list = readPinned();
    const idx = list.findIndex(p => p.compoundSlug === compoundSlug);
    if (idx >= 0) {
      // Unpin
      list.splice(idx, 1);
      writePinned(list);
    } else if (list.length < MAX_PINNED) {
      // Pin
      if (list.length > 0) {
        const firstCategory = list[0].category;
        if (firstCategory && category && firstCategory !== category) {
          toast.error(`You can only compare peptides within the same category ("${firstCategory}").`);
          return;
        }
      }
      const item: PinnedItem = {
        productName: productName ?? compoundName,
        imageUrl: imageUrl ?? null,
        pricePerVialDollars: pricePerVialDollars ?? null,
        compoundSlug,
        evidenceTierKey: evidenceTierKey ?? null,
        category: category ?? null,
        pinnedAt: Date.now(),
      };
      writePinned([...list, item]);
    } else {
      toast.error('You can compare up to 4 compounds at a time.');
    }
    sync();
  }, [compoundSlug, compoundName, evidenceTierKey, productName, imageUrl, pricePerVialDollars, category, sync]);

  const isSmall = size === 'sm';
  const buttonWidth = isSmall ? '120px' : '185px';

  if (pinned) {
    return (
      <button
        type="button"
        onClick={toggle}
        title="Remove from compare"
        style={{
          background: 'none',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          outline: 'none',
          position: 'relative',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: buttonWidth,
          transition: 'transform 0.15s',
          ...style,
        }}
        onMouseOver={e => e.currentTarget.style.transform = 'scale(1.02)'}
        onMouseOut={e => e.currentTarget.style.transform = 'none'}
      >
        <Image
          src="/images/pin-to-compare-btn.png"
          alt="Pinned to Compare"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            display: 'block',
            filter: 'drop-shadow(0 0 6px #00C4BC) brightness(1.1)',
          }}
         width={200} height={200} unoptimized />
        {/* A small absolute check icon in the top right to clearly signal pinned */}
        <div style={{
          position: 'absolute',
          top: -4,
          right: -4,
          background: '#00C4BC',
          borderRadius: '50%',
          width: 18,
          height: 18,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 2px 4px rgba(0,0,0,0.5)',
          border: '1px solid #FFF',
          zIndex: 10,
        }}>
          <Check size={10} color="#04221F" strokeWidth={3} />
        </div>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={full}
      title={full ? 'Compare tray is full (max 4)' : `Add ${compoundName} to compare`}
      style={{
        background: 'none',
        border: 'none',
        padding: 0,
        cursor: full ? 'not-allowed' : 'pointer',
        opacity: full ? 0.4 : 1,
        outline: 'none',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: buttonWidth,
        transition: 'transform 0.15s',
        ...style,
      }}
      onMouseOver={e => { if(!full) e.currentTarget.style.transform = 'scale(1.02)'; }}
      onMouseOut={e => e.currentTarget.style.transform = 'none'}
    >
      <Image
        src="/images/pin-to-compare-btn.png"
        alt="Pin to Compare"
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
