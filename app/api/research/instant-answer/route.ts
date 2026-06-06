/**
 * GET /api/research/instant-answer?q=...
 *
 * Position-0 knowledge-card payload for the search results page. Classifies
 * the parsed query into an IntentKind via lib/research/intent.ts, then
 * pulls the minimum compound data needed to render the relevant card.
 *
 * Returns { kind: 'none' } when the intent is too weak to render a card -
 * the search route still renders the ranked results below in that case.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { parseQuery } from '@/lib/research/search-parser';
import {
  classifyIntent,
  type IntentKind,
  type IntentMatch,
} from '@/lib/research/intent';
import { RESEARCH_AREAS } from '@/lib/compounds';

export const dynamic = 'force-dynamic';

const RESEARCH_NOTE =
  'For Research Use Only. This Restates Stored Laboratory Facts And Is Not Dosing Or Medical Advice.';

interface CompoundCardRow {
  slug: string;
  display_name: string;
  aliases: string[] | null;
  category: string | null;
  evidence_tier: string;
  compound_class: string | null;
  molecular_target: string | null;
  mechanism: string | null;
  studied_for: string[] | null;
  research_areas: string[] | null;
  side_effects: string | null;
  warnings: string | null;
  plain_summary: string | null;
  handling: Record<string, unknown> | null;
  wada_status: string;
  is_stack: boolean | null;
  stack_components: string[] | null;
  stack_rationale: string | null;
  half_life: string | null;
  pk_summary: string | null;
  measured_half_life_hours: number | null;
  predicted_half_life_hours: number | null;
}

async function fetchCompoundCards(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  slugs: string[],
): Promise<CompoundCardRow[]> {
  if (slugs.length === 0) return [];
  const { data, error } = await supabase
    .from('compounds')
    .select(
      'slug, display_name, aliases, category, evidence_tier, compound_class, molecular_target, mechanism, studied_for, research_areas, side_effects, warnings, plain_summary, handling, wada_status, is_stack, stack_components, stack_rationale, half_life, pk_summary, measured_half_life_hours, predicted_half_life_hours',
    )
    .in('slug', slugs);
  if (error || !data) return [];
  // Preserve the order that intent.slugs gave us.
  const order = new Map(slugs.map((s, i) => [s, i] as const));
  return (data as CompoundCardRow[]).sort(
    (a, b) => (order.get(a.slug) ?? 999) - (order.get(b.slug) ?? 999),
  );
}



async function buildPayload(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  intent: IntentMatch,
): Promise<{ payload: Record<string, unknown>; kind: IntentKind }> {
  if (intent.kind === 'none' || intent.confidence === 'low') {
    return { payload: { kind: 'none' as IntentKind }, kind: 'none' };
  }

  const cards = await fetchCompoundCards(supabase, intent.slugs);

  // Category card needs no compound - just the area meta.
  if (intent.kind === 'category') {
    const area = intent.area && RESEARCH_AREAS[intent.area];
    if (!area) return { payload: { kind: 'none' as IntentKind }, kind: 'none' };
    return {
      payload: {
        kind: 'category' as IntentKind,
        area: intent.area,
        label: area.label,
        blurb: area.blurb,
        url: `/research/areas/${intent.area}`,
      },
      kind: 'category',
    };
  }

  if (cards.length === 0) {
    return { payload: { kind: 'none' as IntentKind }, kind: 'none' };
  }

  const primary = cards[0];

  switch (intent.kind) {
    case 'definition':
    case 'mechanism': {
      return {
        payload: {
          kind: intent.kind,
          compound: {
            slug: primary.slug,
            name: primary.display_name,
            plain_summary: primary.plain_summary,
            evidence_tier: primary.evidence_tier,
            wada_status: primary.wada_status,
            mechanism: primary.mechanism,
            molecular_target: primary.molecular_target,
            studied_for: primary.studied_for ?? [],
            url: `/research/compounds/${primary.slug}`,
          },
        },
        kind: intent.kind,
      };
    }

    case 'comparison': {
      return {
        payload: {
          kind: 'comparison' as IntentKind,
          compounds: cards.map((c) => ({
            slug: c.slug,
            name: c.display_name,
            plain_summary: c.plain_summary,
            evidence_tier: c.evidence_tier,
            wada_status: c.wada_status,
            mechanism: c.mechanism,
            studied_for: c.studied_for ?? [],
            url: `/research/compounds/${c.slug}`,
          })),
          compare_url: `/research/compare?slugs=${encodeURIComponent(cards.map((c) => c.slug).join(','))}`,
        },
        kind: 'comparison',
      };
    }

    case 'reconstitution': {
      const handling = (primary.handling ?? {}) as {
        form?: string;
        diluent?: string;
        storage_temp?: string;
        reconstituted_days?: number;
      };
      return {
        payload: {
          kind: 'reconstitution' as IntentKind,
          compound: {
            slug: primary.slug,
            name: primary.display_name,
            url: `/research/compounds/${primary.slug}`,
          },
          handling: {
            form: handling.form ?? null,
            diluent: handling.diluent ?? null,
            storage_temp: handling.storage_temp ?? null,
            reconstituted_days: handling.reconstituted_days ?? null,
          },
          calculator_url: `/research/calculators?compound=${primary.slug}`,
        },
        kind: 'reconstitution',
      };
    }

    case 'side_effects':
    case 'safety': {
      return {
        payload: {
          kind: intent.kind,
          compound: {
            slug: primary.slug,
            name: primary.display_name,
            url: `/research/compounds/${primary.slug}`,
          },
          side_effects: primary.side_effects,
          warnings: primary.warnings,
        },
        kind: intent.kind,
      };
    }



    case 'half_life': {
      const halfLifeText =
        primary.half_life ||
        primary.pk_summary ||
        (primary.measured_half_life_hours !== null
          ? `${primary.measured_half_life_hours} Hours (Measured)`
          : primary.predicted_half_life_hours !== null
            ? `${primary.predicted_half_life_hours} Hours (Predicted)`
            : null);
      return {
        payload: {
          kind: 'half_life' as IntentKind,
          compound: {
            slug: primary.slug,
            name: primary.display_name,
            url: `/research/compounds/${primary.slug}`,
          },
          half_life_text: halfLifeText,
          measured_hours: primary.measured_half_life_hours,
          predicted_hours: primary.predicted_half_life_hours,
        },
        kind: 'half_life',
      };
    }

    case 'stack': {
      return {
        payload: {
          kind: 'stack' as IntentKind,
          components: cards.map((c) => ({
            slug: c.slug,
            name: c.display_name,
            plain_summary: c.plain_summary,
            evidence_tier: c.evidence_tier,
            wada_status: c.wada_status,
            url: `/research/compounds/${c.slug}`,
          })),
          rationale: primary.stack_rationale,
        },
        kind: 'stack',
      };
    }

    case 'storage': {
      const handling = (primary.handling ?? {}) as {
        storage_temp?: string;
        reconstituted_days?: number;
      };
      return {
        payload: {
          kind: 'storage' as IntentKind,
          compound: {
            slug: primary.slug,
            name: primary.display_name,
            url: `/research/compounds/${primary.slug}`,
          },
          storage_temp: handling.storage_temp ?? null,
          reconstituted_days: handling.reconstituted_days ?? null,
        },
        kind: 'storage',
      };
    }

    case 'dose_conversion': {
      return {
        payload: {
          kind: 'dose_conversion' as IntentKind,
          compound: {
            slug: primary.slug,
            name: primary.display_name,
            url: `/research/compounds/${primary.slug}`,
          },
          calculator_url: `/research/calculators?compound=${primary.slug}`,
        },
        kind: 'dose_conversion',
      };
    }

    default:
      return { payload: { kind: 'none' as IntentKind }, kind: 'none' };
  }
}

export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get('q') ?? '').trim();
  if (!q) {
    return NextResponse.json({ kind: 'none', note: RESEARCH_NOTE });
  }

  const parsed = parseQuery(q);
  const supabase = await createServiceClient();

  const { data: catalogData } = await supabase
    .from('compounds')
    .select('slug, display_name, aliases, research_areas, category');
  const catalog = (catalogData ?? []) as Array<{
    slug: string;
    display_name: string;
    aliases: string[] | null;
    research_areas: string[] | null;
    category: string | null;
  }>;

  const intent = classifyIntent(parsed, { catalog });
  const { payload } = await buildPayload(supabase, intent);

  return NextResponse.json({
    ...payload,
    intent,
    note: RESEARCH_NOTE,
  });
}
