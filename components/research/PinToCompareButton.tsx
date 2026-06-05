'use client';

/**
 * PinToCompareButton — writes a compound to the `pnl:compare` localStorage
 * key shared with StorefrontCompareDrawer. Pin from anywhere in the Research
 * Library and the bottom compare drawer activates automatically.
 *
 * Props:
 *   compoundSlug   — the compound's slug (used as compoundSlug in pinned items)
 *   compoundName   — display name
 *   evidenceTierKey — optional tier key for the score engine
 *   productName    — optional product name (falls back to compoundName)
 *   imageUrl       — optional product image url
 *   pricePerVialDollars — optional price
 */

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

  const teal = '#00C4BC';
  const isSmall = size === 'sm';

  if (pinned) {
    return (
      <button
        type="button"
        onClick={toggle}
        title="Remove from compare"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: isSmall ? 4 : 6,
          padding: isSmall ? '5px 10px' : '8px 14px',
          borderRadius: isSmall ? 7 : 9,
          border: `1px solid ${teal}`,
          background: `${teal}18`,
          color: teal,
          fontSize: isSmall ? '0.72rem' : '0.82rem',
          fontWeight: 700,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          transition: 'all 0.15s',
        }}
      >
        <Check size={isSmall ? 11 : 13} />
        {isSmall ? 'Pinned' : 'Pinned to Compare'}
        <X size={isSmall ? 9 : 11} style={{ opacity: 0.6 }} />
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
        display: 'inline-flex',
        alignItems: 'center',
        gap: isSmall ? 4 : 6,
        padding: isSmall ? '5px 10px' : '8px 14px',
        borderRadius: isSmall ? 7 : 9,
        border: '1px solid rgba(255,255,255,0.12)',
        background: full ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.06)',
        color: full ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.6)',
        fontSize: isSmall ? '0.72rem' : '0.82rem',
        fontWeight: 700,
        cursor: full ? 'not-allowed' : 'pointer',
        whiteSpace: 'nowrap',
        transition: 'all 0.15s',
      }}
    >
      <GitCompare size={isSmall ? 11 : 13} />
      {full ? 'Compare Full' : isSmall ? 'Compare' : 'Pin to Compare'}
    </button>
  );
}
