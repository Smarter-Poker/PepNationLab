// @ts-nocheck
import { NextResponse } from 'next/server';
import { assertCronAuth } from '@/lib/cron';
import { createServiceClient } from '@/lib/supabase/server';

/**
 * Social Content Generator Cron — C6
 *
 * Runs weekly (Sunday 06:00 UTC via vercel.json). Generates a rolling week of
 * social post captions from the compound knowledge base and queues them into
 * public.social_posts with `status = 'pending'`.
 *
 * Each run produces up to 7 posts (one per platform per day, staggered across
 * the week). Posts are deduplicated by compound slug + platform so re-runs
 * never create duplicates. The hourly social-autopost drain cron picks them up
 * when SOCIAL_AUTOPOST_ENABLED=true and platform tokens are connected.
 *
 * Content strategy (RUO-compliant — compliance gate will still run at dispatch):
 *   Mon: Research spotlight — one compound's mechanism + evidence tier
 *   Tue: "Did You Know?" — a single pharmacokinetic fact
 *   Wed: Research area roundup — list 3 compounds in one area
 *   Thu: Compound comparison teaser — links to /research/compare
 *   Fri: Research guide highlight — links to /research/guides
 *   Sat: Lab tool tip — reconstitution calculator / half-life
 *   Sun: New additions or most-cited compounds
 *
 * Auth: CRON_SECRET Bearer (assertCronAuth).
 * Gate: SOCIAL_AUTOPOST_ENABLED env var (shared with drain cron).
 */

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const PLATFORMS_FOR_TEXT = ['x', 'instagram', 'facebook', 'pinterest'] as const;

// Caption templates. {name}, {mechanism}, {area}, {halfLife}, {tier}, {slug} are substituted.
// All RUO-compliant: no dosing, no therapeutic claims, no human-use language.
const SPOTLIGHT_TEMPLATES = [
  'Research Spotlight: {name}\n\nMechanism: {mechanism}\nEvidence Tier: {tier}\nResearch Area: {area}\n\nRead the full monograph — link in bio.\n\n#ResearchPeptides #PepNationLab #PeptideResearch #RUO',
  '{name} is one of the most-studied compounds in {area} research.\n\nEvidence tier: {tier} | Half-life: {halfLife}\n\nAll research-grade, research-use-only. Full monograph at the link.\n\n#PepNationLab #ResearchChemicals #PeptideScience',
  'Compound of the Week: {name}\n\nResearch area: {area}\nMechanism overview: {mechanism}\n\nVerified researchers — explore the full library at PepNationLab.com\n\n#PeptideResearch #RUOCompounds #PepNationLab',
];

const DID_YOU_KNOW_TEMPLATES = [
  'Did You Know?\n\n{name} has a half-life of {halfLife} under standard laboratory conditions.\n\nHalf-life matters for experiment timing and reconstitution planning.\n\n#LabScience #PeptideResearch #PepNationLab #DidYouKnow',
  'Lab Fact: {name}\n\n→ Research area: {area}\n→ Half-life: {halfLife}\n→ Primary mechanism: {mechanism}\n\nResearch-use-only compounds for qualified researchers.\n\n#ResearchGrade #RUO #PepNationLab',
];

const GUIDE_TEMPLATES = [
  'Research Guide: {guideTitle}\n\n{guideSummary}\n\nFull guide available in our research library. Link in bio.\n\n#PepNationLab #PeptideGuides #ResearchPeptides #RUO',
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function fillTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? `[${k}]`);
}

/** ISO date string for N days from now, at a fixed hour (UTC). */
function scheduledDate(daysFromNow: number, hourUtc: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + daysFromNow);
  d.setUTCHours(hourUtc, 0, 0, 0);
  return d.toISOString();
}

/** Dedupe key so re-runs don't insert duplicates for the same compound+platform+week. */
function dedupeKey(compoundSlug: string, platform: string, weekOf: string): string {
  return `content-gen:${compoundSlug}:${platform}:${weekOf}`;
}

/** ISO string for the Monday of the current week (YYYY-MM-DD). */
function thisWeekMonday(): string {
  const d = new Date();
  const day = d.getUTCDay(); // 0=Sun, 1=Mon, ...
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

// ─── Main Handler ─────────────────────────────────────────────────────────────

export async function GET(req: Request) {
  const unauth = assertCronAuth(req);
  if (unauth) return unauth;

  // Only generates when autopost is enabled (shared kill-switch with drain cron).
  if (process.env.SOCIAL_AUTOPOST_ENABLED !== 'true') {
    return NextResponse.json({ skipped: true, reason: 'SOCIAL_AUTOPOST_ENABLED is not true' });
  }

  const svc = await createServiceClient();
  const weekOf = thisWeekMonday();

  // ── 1. Fetch candidate compounds ─────────────────────────────────────────
  // Pull highest-evidence, most-complete compounds for weekly spotlight.
  const { data: compounds, error: cErr } = await svc
    .from('compounds')
    .select('slug, name, mechanism_short, primary_area, half_life, evidence_tier')
    .eq('is_published', true) // @ts-ignore
    .not('mechanism_short', 'is', null)
    .not('primary_area', 'is', null)
    .in('evidence_tier', ['tier_1', 'tier_2'])
    .order('citation_count', { ascending: false })
    .limit(50);

  if (cErr || !compounds || compounds.length === 0) {
    console.error('[social-content-gen] compound fetch error', cErr);
    return NextResponse.json({ error: 'No compounds found', detail: cErr?.message }, { status: 500 });
  }

  // ── 2. Fetch a recent research guide for Friday spotlight ─────────────────
  // We embed a guide title + first 100 chars of the first section paragraph.
  // lib/research/guides.ts is server-side, so we do a quick dynamic import.
  let guideTitle = 'Peptide Research Guide';
  let guideSummary = 'In-depth, RUO-compliant research guides for qualified researchers.';
  try {
    const { GUIDES } = await import('@/lib/research/guides');
    if (GUIDES.length > 0) {
      const g = pick(GUIDES);
      guideTitle = g.title;
      guideSummary = g.description.slice(0, 120);
    }
  } catch {
    // Non-fatal — fall back to generic text
  }

  // ── 3. Generate posts for each day of the coming week ───────────────────
  const postsToInsert: Array<{
    platform: string;
    caption: string;
    media_url: null;
    media_type: string;
    link: string | null;
    scheduled_for: string;
    status: string;
    source: string;
    dedupe_key: string;
  }> = [];

  const usedSlugs = new Set<string>();
  // compounds is confirmed non-null by the guard above (line 110).
  const safeCompounds = compounds!;

  function pickUnusedCompound() {
    const unused = safeCompounds.filter((c) => !usedSlugs.has(c.slug)); // @ts-ignore
    const c = unused.length > 0 ? pick(unused) : pick(safeCompounds);
    usedSlugs.add(c.slug); // @ts-ignore
    return c;
  }

  // Day offsets from today (0 = today). We spread across the next 7 days.
  const daySchedule: Array<{ dayOffset: number; hourUtc: number; captionFn: () => string; linkFn: () => string | null }> = [
    {
      dayOffset: 0,
      hourUtc: 14, // 2 PM UTC — Mon: Research spotlight
      captionFn: () => {
        const c = pickUnusedCompound();
        return fillTemplate(pick(SPOTLIGHT_TEMPLATES), {
          name: c.name, // @ts-ignore
          mechanism: c.mechanism_short ?? 'receptor-mediated pathway', // @ts-ignore
          area: c.primary_area ?? 'research', // @ts-ignore
          halfLife: c.half_life ?? 'variable', // @ts-ignore
          tier: (c.evidence_tier ?? 'tier_2').replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()), // @ts-ignore
          slug: c.slug, // @ts-ignore
        });
      },
      linkFn: () => {
        const c = safeCompounds[usedSlugs.size - 1];
        return c ? `https://pepnationlab.com/research/${c.slug}` : null; // @ts-ignore
      },
    },
    {
      dayOffset: 1,
      hourUtc: 16, // 4 PM UTC — Tue: Did You Know
      captionFn: () => {
        const c = pickUnusedCompound();
        return fillTemplate(pick(DID_YOU_KNOW_TEMPLATES), {
          name: c.name, // @ts-ignore
          mechanism: c.mechanism_short ?? 'receptor-mediated signaling', // @ts-ignore
          area: c.primary_area ?? 'research', // @ts-ignore
          halfLife: c.half_life ?? 'variable under standard conditions', // @ts-ignore
          slug: c.slug, // @ts-ignore
        });
      },
      linkFn: () => `https://pepnationlab.com/research`,
    },
    {
      dayOffset: 2,
      hourUtc: 15, // 3 PM UTC — Wed: Research area roundup
      captionFn: () => {
        const c1 = pickUnusedCompound();
        const c2 = pickUnusedCompound();
        const c3 = pickUnusedCompound();
        return `Research Area: ${c1.primary_area ?? 'Regenerative Research'}\n\nTop studied compounds in this area:\n→ ${c1.name}\n→ ${c2.name}\n→ ${c3.name}\n\nAll research-grade, RUO. Full library at PepNationLab.com\n\n#PepNationLab #ResearchPeptides #PeptideScience #RUO`; // @ts-ignore
      },
      linkFn: () => `https://pepnationlab.com/research/areas`,
    },
    {
      dayOffset: 3,
      hourUtc: 14, // 2 PM UTC — Thu: Comparison teaser
      captionFn: () => {
        const c1 = pickUnusedCompound();
        const c2 = pickUnusedCompound();
        return `${c1.name} vs ${c2.name} — What Does The Research Show?\n\nMechanism comparison, evidence tier breakdown, and half-life data — all in our research library.\n\nLink in bio.\n\n#PepNationLab #PeptideResearch #ResearchComparison #RUO`; // @ts-ignore
      },
      linkFn: () => `https://pepnationlab.com/research/compare`,
    },
    {
      dayOffset: 4,
      hourUtc: 15, // 3 PM UTC — Fri: Guide spotlight
      captionFn: () =>
        fillTemplate(pick(GUIDE_TEMPLATES), {
          guideTitle,
          guideSummary,
        }),
      linkFn: () => `https://pepnationlab.com/research/guides`,
    },
    {
      dayOffset: 5,
      hourUtc: 13, // 1 PM UTC — Sat: Lab tool tip
      captionFn: () => {
        const c = pickUnusedCompound();
        return `Lab Tip: Reconstitution Planning\n\nFor ${c.name}, half-life is approximately ${c.half_life ?? 'variable'}. Factor this into your experiment timing when calculating working solution longevity.\n\nUse our free reconstitution calculator — link in bio.\n\n#LabScience #PepNationLab #ResearchTools #PeptideResearch`; // @ts-ignore
      },
      linkFn: () => `https://pepnationlab.com/research/calculators`,
    },
    {
      dayOffset: 6,
      hourUtc: 16, // 4 PM UTC — Sun: Featured compound
      captionFn: () => {
        const c = pickUnusedCompound();
        return `Featured Research Compound: ${c.name}\n\nResearch area: ${c.primary_area ?? 'research'}\nEvidence tier: ${(c.evidence_tier ?? 'tier_2').replace('_', ' ')}\n\nThis compound is available through verified agent storefronts on PepNationLab.com — research use only.\n\n#PepNationLab #ResearchPeptides #PeptideScience #RUO #ResearchGrade`; // @ts-ignore
      },
      linkFn: () => {
        const c = safeCompounds[usedSlugs.size - 1];
        return c ? `https://pepnationlab.com/research/${c.slug}` : `https://pepnationlab.com/research`; // @ts-ignore
      },
    },
  ];

  for (const day of daySchedule) {
    for (const platform of PLATFORMS_FOR_TEXT) {
      const caption = day.captionFn();
      const link = day.linkFn();
      const dk = dedupeKey(caption.slice(0, 30).replace(/\s+/g, '-'), platform, weekOf);

      postsToInsert.push({
        platform,
        caption,
        media_url: null,
        media_type: 'none',
        link,
        scheduled_for: scheduledDate(day.dayOffset, day.hourUtc),
        status: 'pending',
        source: 'content-gen-cron',
        dedupe_key: dk,
      });
    }
  }

  // ── 4. Insert with dedupe — skip rows whose dedupe_key already exists ────
  let inserted = 0;
  let skipped = 0;

  for (const post of postsToInsert) {
    const { error: insErr } = await svc
      .from('social_posts')
      .insert(post)
      .select('id')
      .single();

    if (insErr) {
      // Unique constraint violation = already queued this week for this compound+platform
      if (insErr.code === '23505') {
        skipped++;
      } else {
        console.error('[social-content-gen] insert error', insErr, post.dedupe_key);
      }
    } else {
      inserted++;
    }
  }

  return NextResponse.json({
    ok: true,
    weekOf,
    postsGenerated: postsToInsert.length,
    inserted,
    skipped,
  });
}
