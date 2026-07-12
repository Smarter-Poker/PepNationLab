'use client';

import { useMemo } from 'react';
import DiscoveryHero from '../storefront/StorefrontDiscovery';
import type { Compound } from '@/lib/compounds';
import { useRouter } from 'next/navigation';
import { DEFAULT_STORE_SLUG } from '@/lib/default-store';

/**
 * Find A Peptide hero. Renders ONLY the dynamic goal-selector image
 * (DiscoveryHero). Each hotspot on the image routes to its own destination:
 *   - A goal tile        -> the Match Me To A Peptide engine, pre-filtered by
 *                           that research area (auto-runs the match).
 *   - Match Me           -> the Match Me To A Peptide engine.
 *   - Let Us Guide You    -> DiscoveryHero's built-in step-by-step guided (AI)
 *                           wizard (left un-overridden so it opens in place).
 *   - Already Know...     -> the Pep Nation research store (house storefront).
 *   - Ask Us Anything box -> DiscoveryHero's native in-page AI match.
 */
export default function MatchPageHero({ compounds }: { compounds: Compound[] }) {
  const router = useRouter();

  // Convert array to map for DiscoveryHero (used for its wizard areas + lookups).
  const compoundsBySlug = useMemo(() => {
    const map: Record<string, Compound> = {};
    for (const c of compounds) {
      if (c.slug) map[c.slug] = c;
    }
    return map;
  }, [compounds]);

  return (
    <DiscoveryHero
      compoundsBySlug={compoundsBySlug}
      resolveProducts={() => []} // No e-commerce products on this global page
      onAddToCart={() => {}}
      onOpenProduct={() => {}}
      primaryColor="#00C4BC"
      // A goal tile opens the Match Me To A Peptide engine, pre-filtered by that goal.
      onSelectArea={(area) => {
        router.push(`/research/match?goal=${encodeURIComponent(area)}&run=true`);
      }}
      // The Match Me button opens the Match Me To A Peptide engine.
      onMatchMeClick={() => {
        router.push('/research/match');
      }}
      // Let Us Guide You is intentionally NOT overridden so DiscoveryHero opens
      // its built-in step-by-step guided (AI) wizard.
      // Already Know Which Peptide You Need -> the Pep Nation research store.
      onAlreadyKnowClicked={() => {
        router.push(`/${DEFAULT_STORE_SLUG}`);
      }}
      // The "Ask Us Anything" search box is left to DiscoveryHero's native
      // behavior (runs the in-page AI match engine).
    />
  );
}
