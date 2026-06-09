import { NextResponse, type NextRequest } from 'next/server';
import { requireAgent } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/shipping/address-autocomplete?q=...
 *
 * Type-ahead address suggestions for the onboarding warehouse step (and any
 * other address field). Agent-gated. Returns normalized US address parts the
 * form can drop straight into its fields:
 *
 *   { suggestions: [{ label, street1, city, state, zip }] }
 *
 * Provider strategy (no key required to work):
 *   - If MAPBOX_TOKEN is set, use Mapbox geocoding (one call, structured parts).
 *   - Otherwise fall back to Photon (komoot) -- a free, key-less OpenStreetMap
 *     geocoder suitable for low-volume type-ahead.
 * Either way the final address is still validated/standardized by Shippo when
 * the user saves the step, so this layer only needs to speed up entry.
 *
 * This is a best-effort helper: any upstream failure returns an empty list so
 * the user can always keep typing the address by hand.
 */

type Suggestion = { label: string; street1: string; city: string; state: string; zip: string };

// Photon returns full state names; the form + Shippo expect 2-letter codes.
const STATE_ABBR: Record<string, string> = {
  alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR', california: 'CA',
  colorado: 'CO', connecticut: 'CT', delaware: 'DE', 'district of columbia': 'DC',
  florida: 'FL', georgia: 'GA', hawaii: 'HI', idaho: 'ID', illinois: 'IL',
  indiana: 'IN', iowa: 'IA', kansas: 'KS', kentucky: 'KY', louisiana: 'LA',
  maine: 'ME', maryland: 'MD', massachusetts: 'MA', michigan: 'MI', minnesota: 'MN',
  mississippi: 'MS', missouri: 'MO', montana: 'MT', nebraska: 'NE', nevada: 'NV',
  'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY',
  'north carolina': 'NC', 'north dakota': 'ND', ohio: 'OH', oklahoma: 'OK',
  oregon: 'OR', pennsylvania: 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
  'south dakota': 'SD', tennessee: 'TN', texas: 'TX', utah: 'UT', vermont: 'VT',
  virginia: 'VA', washington: 'WA', 'west virginia': 'WV', wisconsin: 'WI', wyoming: 'WY',
  'puerto rico': 'PR',
};

function toStateAbbr(raw: string | undefined | null): string {
  if (!raw) return '';
  const t = String(raw).trim();
  if (/^[A-Za-z]{2}$/.test(t)) return t.toUpperCase();
  return STATE_ABBR[t.toLowerCase()] ?? '';
}

function buildLabel(s: Omit<Suggestion, 'label'>): string {
  const tail = [s.state, s.zip].filter(Boolean).join(' ');
  return [s.street1, s.city, tail].filter(Boolean).join(', ');
}

function dedupe(list: Suggestion[]): Suggestion[] {
  const seen = new Set<string>();
  const out: Suggestion[] = [];
  for (const s of list) {
    const k = s.label.toLowerCase();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(s);
  }
  return out;
}

/** Free, key-less OpenStreetMap geocoder. Biased toward the US. */
async function photon(q: string): Promise<Suggestion[]> {
  // bbox biases (does not hard-restrict) results to the continental US.
  const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=8&lang=en&bbox=-125,24,-66,50`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'PepNationLab/1.0 (+https://pepnationlab.com)' },
    signal: AbortSignal.timeout(4000),
  });
  if (!res.ok) return [];
  const data = await res.json().catch(() => null);
  const feats: unknown[] = Array.isArray(data?.features) ? data.features : [];
  const out: Suggestion[] = [];
  for (const f of feats) {
    const p = ((f as { properties?: Record<string, unknown> })?.properties) ?? {};
    if (p.countrycode && String(p.countrycode).toUpperCase() !== 'US') continue;
    const house = p.housenumber ? `${String(p.housenumber).trim()} ` : '';
    const streetName = (p.street as string) || (p.name as string) || '';
    const street1 = `${house}${streetName}`.trim();
    const city = (p.city as string) || (p.town as string) || (p.village as string) || (p.county as string) || '';
    const state = toStateAbbr(p.state as string);
    const zip = (p.postcode as string) || '';
    if (!street1 && !city) continue;
    out.push({ street1, city, state, zip, label: buildLabel({ street1, city, state, zip }) });
  }
  return dedupe(out).slice(0, 6);
}

/** Mapbox geocoding (used only when MAPBOX_TOKEN is configured). */
async function mapbox(q: string, token: string): Promise<Suggestion[]> {
  const url = `https://api.mapbox.com/search/geocode/v6/forward?q=${encodeURIComponent(q)}&autocomplete=true&country=us&types=address&limit=6&access_token=${encodeURIComponent(token)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
  if (!res.ok) return [];
  const data = await res.json().catch(() => null);
  const feats: unknown[] = Array.isArray(data?.features) ? data.features : [];
  const out: Suggestion[] = [];
  for (const f of feats) {
    const props = ((f as { properties?: Record<string, unknown> })?.properties) ?? {};
    const ctx = (props.context as Record<string, { name?: string; region_code?: string }>) ?? {};
    const street1 = (props.name as string) || '';
    const city = ctx.place?.name || '';
    const state = toStateAbbr(ctx.region?.region_code || ctx.region?.name);
    const zip = ctx.postcode?.name || '';
    if (!street1 && !city) continue;
    out.push({ street1, city, state, zip, label: buildLabel({ street1, city, state, zip }) });
  }
  return dedupe(out).slice(0, 6);
}

export async function GET(req: NextRequest) {
  const gate = await requireAgent();
  if (!gate.ok) return gate.response;

  const q = (new URL(req.url).searchParams.get('q') || '').trim();
  // Only start once "enough data" is typed, so we don't fire on a few letters.
  if (q.length < 4) return NextResponse.json({ suggestions: [] });

  try {
    const token = process.env.MAPBOX_TOKEN;
    const suggestions = token ? await mapbox(q, token) : await photon(q);
    return NextResponse.json({ suggestions });
  } catch {
    // Never block the form on an autocomplete hiccup.
    return NextResponse.json({ suggestions: [] });
  }
}
