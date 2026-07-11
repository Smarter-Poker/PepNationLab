// Validates the expanded cities-data.ts. Exits 1 on any failure.
import { readFileSync } from 'node:fs';
const { CITIES } = await import(new URL('../../lib/cities/cities-data.ts', import.meta.url).href);

let failed = false;
function fail(msg) {
  console.error('FAIL: ' + msg);
  failed = true;
}

// No em or en dashes anywhere in the file.
const raw = readFileSync(new URL('../../lib/cities/cities-data.ts', import.meta.url), 'utf8');
if (/[–—]/.test(raw)) fail('em or en dash found in cities-data.ts');

// Unique stateSlug/slug pairs and well-formed slugs.
const seen = new Set();
for (const c of CITIES) {
  const k = c.stateSlug + '/' + c.slug;
  if (seen.has(k)) fail('duplicate key ' + k);
  seen.add(k);
  if (!/^[a-z0-9-]+$/.test(c.slug)) fail('bad slug ' + c.slug);
  if (!/^[a-z-]+$/.test(c.stateSlug)) fail('bad stateSlug ' + c.stateSlug);
}

// Globally unique blurbs.
const blurbs = new Set();
for (const c of CITIES) {
  if (c.localBlurb) {
    if (blurbs.has(c.localBlurb)) fail('duplicate blurb on ' + c.stateSlug + '/' + c.slug);
    blurbs.add(c.localBlurb);
  }
}

// Expected counts.
const expected = {
  california: 103,
  alaska: 5,
  delaware: 7,
  idaho: 9,
  kentucky: 8,
  maine: 8,
  mississippi: 7,
  montana: 8,
  'new-hampshire': 9,
  'north-dakota': 5,
  'rhode-island': 6,
  'south-dakota': 5,
  vermont: 6,
  'west-virginia': 6,
  wyoming: 7,
};
const byState = {};
for (const c of CITIES) (byState[c.stateSlug] ||= []).push(c);
for (const [st, n] of Object.entries(expected)) {
  const got = (byState[st] || []).length;
  if (got !== n) fail(st + ' count expected ' + n + ', got ' + got);
}
if (CITIES.length !== 913) fail('total expected 913, got ' + CITIES.length);
if (Object.keys(byState).length !== 50) fail('expected 50 states, got ' + Object.keys(byState).length);

// Full-quality checks for every city in the expanded states.
for (const st of Object.keys(expected)) {
  for (const c of byState[st] || []) {
    if (!c.county) fail('missing county ' + st + '/' + c.slug);
    if (!c.zips || c.zips.length === 0) fail('missing zips ' + st + '/' + c.slug);
    else for (const z of c.zips) if (!/^\d{5}$/.test(z)) fail('bad zip ' + z + ' on ' + c.slug);
    if (!c.localBlurb) fail('missing blurb ' + st + '/' + c.slug);
    else if (/[–—]/.test(c.localBlurb)) fail('em or en dash in blurb ' + c.slug);
    if (!c.region) fail('missing region ' + st + '/' + c.slug);
    if (![1, 2, 3].includes(c.tier)) fail('bad tier ' + c.slug);
    if (!c.name || !c.state || !c.stateAbbr) fail('missing base fields ' + c.slug);
    if (!(c.population > 0) || !(c.medianIncome > 0)) fail('bad numbers ' + c.slug);
  }
}

// No 404 regressions: every previously live stateSlug/slug pair must survive.
const REQUIRED = readFileSync(new URL('./required-pairs.txt', import.meta.url), 'utf8').trim().split(',');
if (REQUIRED.length !== 745) fail('required pair list corrupted: ' + REQUIRED.length);
for (const k of REQUIRED) if (!seen.has(k)) fail('removed existing city ' + k);

if (failed) process.exit(1);

const dist = { 1: 0, 2: 0, 3: 0 };
for (const c of CITIES) dist[c.tier]++;
console.log(
  'OK total=' + CITIES.length +
  ' states=' + Object.keys(byState).length +
  ' ca=' + byState.california.length +
  ' tiers t1=' + dist[1] + ' t2=' + dist[2] + ' t3=' + dist[3]
);
