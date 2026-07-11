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
 * Agent slugs and reserved top-level routes were verified to have zero
 * collisions with any city bare-slug. Ambiguous names (e.g. springfield, in
 * multiple states) resolve to the highest-priority market: lowest tier number,
 * then highest population.
 */
const fs = require('fs');
const path = require('path');

const re = /slug:\s*'([^']+)',\s*state:\s*'[^']+',\s*stateSlug:\s*'([^']+)',\s*stateAbbr:\s*'[^']+',\s*population:\s*(\d+),\s*medianIncome:\s*\d+,\s*tier:\s*(\d)/g;

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

// Map every bare form (exact slug + de-hyphenated) to the candidate cities.
const byForm = new Map();
for (const c of cities) {
  for (const form of new Set([c.slug, c.slug.replace(/-/g, '')])) {
    if (!byForm.has(form)) byForm.set(form, []);
    byForm.get(form).push(c);
  }
}

const redirects = [];
for (const [form, candidates] of byForm) {
  const best = [...candidates].sort((a, b) => a.tier - b.tier || b.population - a.population)[0];
  const destination = `/peptides/${best.stateSlug}/${best.slug}`;
  if (`/${form}` !== destination) {
    redirects.push({ source: `/${form}`, destination, permanent: false });
  }
}

module.exports = redirects;
