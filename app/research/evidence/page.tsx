/**
 * Evidence & Safety Reference - a cross-compound hub that surfaces how strong
 * the evidence is for each catalog compound, which compounds carry risk flags,
 * and which carry notable safety flags. Server component computes the data and
 * hands it to EvidenceSafetyTabs, which shows one category at a time (Evidence /
 * Safety Flags) instead of one long scroll. Research-use-only throughout.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { getAllCompounds } from '@/lib/compounds-server';
import { RISK_META, evidenceTier } from '@/lib/compounds';
import type { Compound } from '@/lib/compounds';
import EvidenceSafetyTabs, {
  type EvidenceGroup,
  type FlaggedRow,
} from '@/components/research/EvidenceSafetyTabs';

export const metadata: Metadata = {
  title: 'Evidence & Safety Reference | Research Library | Pep Nation Lab',
  robots: { index: false, follow: false },
};

const TIER_ORDER = ['approved_drug', 'investigational', 'preclinical', 'research_chemical', 'cosmetic', 'supply'];

export default async function EvidenceSafetyPage() {
  const compounds = await getAllCompounds();

  const byTier: Record<string, Compound[]> = {};
  for (const c of compounds) {
    const t = c.evidence_tier || 'research_chemical';
    (byTier[t] ||= []).push(c);
  }
  const groups: EvidenceGroup[] = TIER_ORDER.filter((t) => byTier[t]?.length).map((t) => {
    const meta = evidenceTier(t);
    return {
      tier: t,
      label: meta.label,
      color: meta.color,
      blurb: meta.blurb ?? '',
      items: byTier[t]
        .slice()
        .sort((a, b) => a.display_name.localeCompare(b.display_name))
        .map((c) => ({ slug: c.slug, name: c.display_name })),
    };
  });



  const order = { critical: 0, high: 1, moderate: 2, low: 3 } as Record<string, number>;
  const flagged: FlaggedRow[] = compounds
    .filter((c) => c.risk_level === 'critical' || c.risk_level === 'high' || c.is_pro_angiogenic || c.is_glp1 || c.is_temp_sensitive)
    .sort((a, b) => (order[a.risk_level] ?? 9) - (order[b.risk_level] ?? 9) || a.display_name.localeCompare(b.display_name))
    .map((c) => {
      const risk = RISK_META[c.risk_level];
      const flags: string[] = [];
      if (c.is_pro_angiogenic) flags.push('Pro-Angiogenic');
      if (c.is_glp1) flags.push('GLP-1 Class');
      if (c.is_temp_sensitive) flags.push('Cold-Chain');
      return {
        slug: c.slug,
        name: c.display_name,
        riskLevel: c.risk_level,
        riskLabel: risk?.label ?? null,
        riskColor: risk?.color ?? null,
        riskBg: risk?.bg ?? null,
        flags,
        reasons: c.risk_reasons ?? [],
      };
    });

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: 'var(--space-6, 32px) var(--space-4, 16px)' }}>
      <nav style={{ marginBottom: 'var(--space-4, 16px)' }}>
        <Link href="/research" style={{ color: 'var(--teal, #00C4BC)', fontSize: '0.9rem', textDecoration: 'none' }}>
          Back To Research Library
        </Link>
      </nav>

      <header style={{ marginBottom: 'var(--space-6, 32px)' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--white, #FFFFFF)', margin: 0 }}>
          Evidence & Safety Reference
        </h1>
        <p style={{ color: 'var(--silver, #A8B4C0)', fontSize: '1.05rem', marginTop: 'var(--space-2, 8px)', maxWidth: '760px' }}>
          A Cross-Compound View Of How Strong The Evidence Is, And Which Compounds Carry
          Notable Safety Flags. Pick A Category Below. For Laboratory Research Only. Not Medical Advice Or Dosing Guidance.
        </p>
      </header>

      <EvidenceSafetyTabs groups={groups} flagged={flagged} />
    </div>
  );
}
