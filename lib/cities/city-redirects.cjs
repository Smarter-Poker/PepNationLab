/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Bare / vanity city-slug redirects, generated at build time from the
 * per-state city data files in lib/cities/data/ (with cities-data.ts scanned
 * too for any inline entries). Applied at the edge by next.config.ts BEFORE
 * routing, so a short URL like /oaklawn or /oak-lawn resolves to the canonical
 * /peptides/<state>/<city> page regardless of the [agentSlug] serverless route
 * (whose in-route city fallback proved unreliable at runtime).
 *
 * Plain CommonJS (safe to require from next.config.ts). Parses the city data
 * sources with a regex keyed on their stable field order (slug, state,
 * stateSlug, stateAbbr, population, medianIncome, tier), so it stays in sync
 * as cities are added and needs no build step.
 *
 * History: this file originally parsed only cities-data.ts. When the city list
 * was split into per-state files under lib/cities/data/ (cities-data.ts became
 * an import barrel), the regex silently matched zero cities and every vanity
 * redirect vanished from production. The zero-city guard below now fails the
 * build loudly instead of shipping an empty redirect list.
 *
 * --- STOREFRONT SLUGS ALWAYS WIN (2026-07-30) ---
 * The header used to claim "Agent slugs and reserved top-level routes were
 * verified to have zero collisions with any city bare-slug." That was true on
 * the day it was written and became false the moment an agent claimed a slug
 * that is also a US city name. It happened: the agent storefront `melissa`
 * collided with Melissa, Texas.
 *
 * A collision is not cosmetic. next.config redirects are applied BEFORE
 * middleware, so proxy.ts never sees the request and cannot defend the
 * storefront. The observed production behaviour for a scanned QR code was:
 *
 *   /melissa?utm_source=qr  ->307  /peptides/texas/melissa?utm_source=qr
 *                           ->307  /login?redirect=%2Fpeptides%2Ftexas%2Fmelissa...
 *
 * i.e. a blank page for two round trips and then a login wall - the exact
 * opposite of what a referral QR exists to do. With `?ref=<code>` it was worse:
 * the guest-confinement gate bounced /peptides/texas/melissa back to /melissa
 * and the browser looped until it gave up.
 *
 * So collisions are now DESIGNED OUT rather than asserted away. Every bare
 * form is checked against the live storefront-slug list (fetched from Supabase
 * at build time) plus a committed fallback list plus the reserved app routes
 * parsed out of lib/store-slug.ts. A colliding form is dropped: the storefront
 * keeps the URL, and the city page is still reachable at its canonical
 * /peptides/<state>/<city> address, which is the only form in sitemap.xml.
 *
 * Exported as an async factory because the storefront-slug lookup is a network
 * call. next.config.ts's redirects() is already async, so it simply awaits it.
 *
 * Ambiguous city names (e.g. springfield, in multiple states) resolve to the
 * highest-priority market: lowest tier number, then highest population.
 */
const fs = require('fs');
const path = require('path');

const re = /slug:\s*'([^']+)',\s*state:\s*'[^']+',\s*stateSlug:\s*'([^']+)',\s*stateAbbr:\s*'[^']+',\s*population:\s*(\d+),\s*medianIncome:\s*\d+,\s*tier:\s*(\d)/g;

/**
 * Storefront slugs live in agent_profiles.slug and change whenever an agent is
 * created or renamed, so the authoritative list is the database. This snapshot
 * is the fallback for builds that cannot reach Supabase (no service-role key
 * in the build environment, network egress blocked, Supabase incident). It is
 * deliberately generous - an extra name here only means one vanity city
 * shortcut is not emitted, while a MISSING name means a live storefront gets
 * shadowed by a redirect the middleware cannot override.
 *
 * Snapshot taken 2026-07-30 (60 storefronts).
 */
const FALLBACK_STORE_SLUGS = [
  'adam', 'amanda', 'anna2', 'art', 'ayman', 'barbie', 'beethepainter',
  'bernal', 'betsy', 'brandon-schweitzer', 'brian', 'cindydelamora', 'colie',
  'cologero', 'cologro', 'curtis', 'dapper', 'dennis', 'doitbigchicago',
  'dolci', 'eddierazz', 'edgardocuadrado21', 'flores', 'gorczakt3', 'helix',
  'jamie', 'joe', 'johnnydee', 'josh', 'jpoz', 'justin', 'kathy',
  'lisa-anderson', 'marcela', 'mcbride', 'melissa', 'mikeg', 'naun', 'nick',
  'nicole', 'odai', 'omar', 'paigenicolette', 'peanut', 'pep-it-up', 'rachel',
  'rafal', 'researchstore', 'savagebrands', 'scooters', 'sebestian', 'steph',
  'timmyd', 'tjp', 'todd', 'tommy', 'tyler', 'valor', 'victor', 'vinny',
];

/**
 * Reserved first-path segments, parsed out of lib/store-slug.ts so there is
 * still exactly ONE source of truth. A .cjs required from next.config cannot
 * import the TypeScript module directly, but it can read it. If the parse ever
 * comes back empty we fall through to the storefront lists only rather than
 * failing the build - reserved segments have never actually collided, and a
 * hard failure here would be a worse outcome than a missed assertion.
 */
function readReservedSegments() {
  try {
    const src = fs.readFileSync(path.join(__dirname, '..', 'store-slug.ts'), 'utf8');
    const block = src.match(/RESERVED_SEGMENTS\s*=\s*new Set\(\[([\s\S]*?)\]\)/);
    if (!block) return [];
    return [...block[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
  } catch {
    return [];
  }
}

/**
 * Live storefront slugs. Best effort: any failure returns null and the caller
 * falls back to FALLBACK_STORE_SLUGS. Never throws, never hangs the build.
 */
async function fetchLiveStoreSlugs() {
  const base = (
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    ''
  ).replace(/\/$/, '');
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    '';
  if (!base || !key || typeof fetch !== 'function') return null;

  try {
    const res = await fetch(
      `${base}/rest/v1/agent_profiles?select=slug&slug=not.is.null&limit=5000`,
      {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(8000),
      },
    );
    if (!res.ok) return null;
    const rows = await res.json();
    if (!Array.isArray(rows) || rows.length === 0) return null;
    return rows
      .map((r) => (typeof r.slug === 'string' ? r.slug.toLowerCase() : null))
      .filter(Boolean);
  } catch {
    return null;
  }
}

module.exports = async function buildCityRedirects() {
  const sources = [];
  const dataDir = path.join(__dirname, 'data');
  if (fs.existsSync(dataDir)) {
    for (const f of fs.readdirSync(dataDir).sort()) {
      if (f.endsWith('.ts')) sources.push(fs.readFileSync(path.join(dataDir, f), 'utf8'));
    }
  }
  sources.push(fs.readFileSync(path.join(__dirname, 'cities-data.ts'), 'utf8'));

  const cities = [];
  for (const src of sources) {
    let m;
    re.lastIndex = 0;
    while ((m = re.exec(src)) !== null) {
      cities.push({ slug: m[1], stateSlug: m[2], population: Number(m[3]), tier: Number(m[4]) });
    }
  }

  if (cities.length === 0) {
    throw new Error(
      'city-redirects.cjs parsed ZERO cities. The city data layout or field order changed; update the parser so vanity city redirects do not silently disappear.'
    );
  }

  // Build the "never shadow this" set. Live DB list when we can get it, the
  // committed snapshot otherwise, ALWAYS unioned with the snapshot so a
  // partially-returned query can never un-protect a storefront we already know
  // about. Reserved app routes are folded in for completeness.
  const live = await fetchLiveStoreSlugs();
  const blocked = new Set();
  for (const s of FALLBACK_STORE_SLUGS) blocked.add(s.toLowerCase());
  if (live) for (const s of live) blocked.add(s);
  for (const s of readReservedSegments()) blocked.add(s.toLowerCase());
  // A storefront slug may itself contain hyphens (`pep-it-up`,
  // `brandon-schweitzer`). The city generator emits a de-hyphenated form of
  // every city slug, so block the de-hyphenated form of every storefront slug
  // too - otherwise /pepitup could still be handed to a city page.
  for (const s of [...blocked]) blocked.add(s.replace(/-/g, ''));

  // Map every bare form (exact slug + de-hyphenated) to the candidate cities.
  const byForm = new Map();
  for (const c of cities) {
    for (const form of new Set([c.slug, c.slug.replace(/-/g, '')])) {
      if (!byForm.has(form)) byForm.set(form, []);
      byForm.get(form).push(c);
    }
  }

  const redirects = [];
  const dropped = [];
  for (const [form, candidates] of byForm) {
    if (blocked.has(form.toLowerCase())) {
      // A live storefront (or an app route) owns this URL. Emitting the
      // redirect anyway would make that storefront permanently unreachable -
      // next.config redirects run before middleware, so proxy.ts could not
      // rescue it. The city keeps its canonical /peptides/<state>/<city> URL,
      // which is the only form the sitemap has ever advertised.
      dropped.push(form);
      continue;
    }
    const best = [...candidates].sort((a, b) => a.tier - b.tier || b.population - a.population)[0];
    const destination = `/peptides/${best.stateSlug}/${best.slug}`;
    if (`/${form}` !== destination) {
      // Keep track of best tier/population so we can sort the overall list
      redirects.push({ source: `/${form}`, destination, permanent: false, _tier: best.tier, _pop: best.population });
    }
  }

  if (dropped.length > 0) {
    // eslint-disable-next-line no-console
    console.log(
      `[city-redirects] ${dropped.length} vanity redirect(s) withheld because a storefront or app route owns the URL: ${dropped.sort().join(', ')}`
    );
  }

  // Next.js limits max custom routes (redirects) to 1000.
  // Sort to ensure Tier 1 / highest pop are preserved, then slice.
  redirects.sort((a, b) => a._tier - b._tier || b._pop - a._pop);
  return redirects.slice(0, 950).map((r) => {
    delete r._tier;
    delete r._pop;
    return r;
  });
};
