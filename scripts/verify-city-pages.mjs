/**
 * scripts/verify-city-pages.mjs
 *
 * Automated city landing page health verifier. Fetches EVERY city page on
 * production and asserts the full "Oak Lawn checklist" against each one:
 *
 *   1.  HTTP 200
 *   2.  <meta name="robots"> allows indexing (index, follow)
 *   3.  Canonical URL is exact and self-referencing
 *   4.  <title> and <h1> contain the city name
 *   5.  JSON-LD present: Service, BreadcrumbList, WebPage, Product nodes
 *       (ItemList warned when the live Top 10 did not load)
 *   6.  Live storefront Top 10 rendered (>= 10 deep links into the store,
 *       proving live data, not the static fallback)
 *   7.  Local content present: county, first ZIP, and local blurb fragment
 *       (when the city record has them)
 *   8.  Every city URL is present in sitemap.xml
 *   9.  Hero image alt embeds the city ("Research Peptides In {city}")
 *   10. Product card alt SEO present (>= 8 "Available To Researchers In")
 *   11. Hidden At A Glance fact block present in the HTML (visually hidden,
 *       must never be removed - answer-engine content)
 *   12. Region label wired into the page when the city has a region
 *   13. FAQ content present (>= 3 <details> blocks)
 *   14. Meta description contains the city name
 *   15. Per-city OG image endpoint referenced (warning only)
 *
 * Zero dependencies (global fetch, Node 22+). City data is imported straight
 * from lib/cities/cities-data.ts via --experimental-strip-types so the check
 * list can NEVER drift from the deployed city set.
 *
 * Run:  node --experimental-strip-types scripts/verify-city-pages.mjs
 * Env:  VERIFY_BASE_URL  - override target host
 *       VERIFY_STATES    - comma-separated stateSlugs to limit the run
 *       VERIFY_SAMPLE    - max N random cities per state (with VERIFY_STATES)
 * Exit: 0 all pages healthy, 1 any failure (fails the CI job loudly).
 *
 * Wired to .github/workflows/city-pages-verify.yml (daily cron + on changes
 * to this script, the workflow, or cities-data.ts). Results are posted to
 * the pinned "City Pages Health Report" GitHub issue.
 */

import { CITIES } from '../lib/cities/cities-data.ts';

const BASE = process.env.VERIFY_BASE_URL || 'https://pepnationlab.com';
const CONCURRENCY = 8;
const RETRIES = 2; // ISR cold pages can be slow on first hit; retry before failing
const FETCH_TIMEOUT_MS = 30000;

function selectCities() {
  const statesEnv = (process.env.VERIFY_STATES || '').trim();
  const sample = Number(process.env.VERIFY_SAMPLE || 0);
  let list = [...CITIES];
  if (statesEnv) {
    const wanted = new Set(statesEnv.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean));
    list = list.filter((c) => wanted.has(c.stateSlug));
    if (sample > 0) {
      const byState = new Map();
      for (const c of list) {
        if (!byState.has(c.stateSlug)) byState.set(c.stateSlug, []);
        byState.get(c.stateSlug).push(c);
      }
      list = [];
      for (const arr of byState.values()) {
        const shuffled = arr.sort(() => Math.random() - 0.5);
        list.push(...shuffled.slice(0, sample));
      }
    }
  }
  return list;
}

function timeoutFetch(url, ms = FETCH_TIMEOUT_MS) {
  return fetch(url, {
    redirect: 'follow',
    signal: AbortSignal.timeout(ms),
    headers: {
      'User-Agent':
        'PepNationLab-CityPageVerifier/2.0 (+https://pepnationlab.com; automated health check)',
    },
  });
}

/** Escape a string the way React/Next escapes text content in SSR HTML. */
function htmlEscape(s) {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#x27;');
}

/**
 * Punctuation-insensitive text normalization applied to BOTH the page HTML
 * and the expected content fragments, so entity escaping and copy-editing
 * passes can never cause false failures.
 */
function normalizeText(s) {
  return s
    .replace(/&#x27;|&#39;|&apos;|&quot;|&amp;|&#\d+;/g, ' ')
    .replace(/[^A-Za-z0-9]+/g, ' ')
    .toLowerCase()
    .trim();
}

/** First few normalized words of the local blurb, for containment checks. */
function blurbFragment(blurb) {
  const words = normalizeText(blurb).split(' ').filter(Boolean).slice(0, 6).join(' ');
  return words.length >= 10 ? words : null;
}

function countOccurrences(haystack, needle) {
  return haystack.split(needle).length - 1;
}

function checkPage(city, html, finalUrl) {
  const url = `${BASE}/peptides/${city.stateSlug}/${city.slug}`;
  const failures = [];
  const warnings = [];
  const normHtml = normalizeText(html);
  const escapedName = htmlEscape(city.name);

  // 2. Indexability
  if (!/<meta[^>]+name="robots"[^>]+content="index/i.test(html)) {
    failures.push('robots meta does not allow indexing');
  }
  // 3. Canonical
  if (!html.includes(`rel="canonical" href="${url}"`) && !html.includes(`href="${url}" rel="canonical"`)) {
    failures.push('canonical missing or not self-referencing');
  }
  // 4. Title + H1
  const titleMatch = html.match(/<title>([^<]*)<\/title>/i);
  if (!titleMatch || !(titleMatch[1].includes(city.name) || titleMatch[1].includes(escapedName))) {
    failures.push('title does not contain city name');
  }
  const h1Block = html.match(/<h1[\s\S]*?<\/h1>/i);
  if (!h1Block || !(h1Block[0].includes(city.name) || h1Block[0].includes(escapedName))) {
    failures.push('h1 does not contain city name');
  }
  // 5. Structured data
  if (!html.includes('application/ld+json')) {
    failures.push('no JSON-LD on page');
  } else {
    if (!html.includes('"@type":"Service"')) failures.push('Service schema missing');
    if (!html.includes('"@type":"BreadcrumbList"')) failures.push('BreadcrumbList schema missing');
    if (!html.includes('"@type":"WebPage"')) failures.push('WebPage schema missing');
    if (!html.includes('"@type":"ItemList"')) {
      warnings.push('ItemList schema missing (live Top 10 may not have loaded)');
    } else if (!html.includes('"@type":"Product"')) {
      // Product nodes are emitted alongside ItemList from the same live data.
      failures.push('Product schema nodes missing despite ItemList present');
    }
  }
  // 6. Live storefront Top 10 (deep links prove live data, not fallback)
  const productLinks = countOccurrences(html, 'researchstore?product=');
  if (productLinks < 10) {
    failures.push(`live Top 10 not rendered (${productLinks} store deep links, expected >= 10)`);
  }
  // 7. Local content - compared on normalized text so punctuation and
  // entity-escaping differences can never produce false failures.
  if (city.county && !normHtml.includes(normalizeText(city.county))) {
    failures.push(`county "${city.county}" missing from page`);
  }
  if (city.zips && city.zips.length > 0 && !html.includes(city.zips[0])) {
    failures.push(`zip ${city.zips[0]} missing from page`);
  }
  if (city.localBlurb) {
    const frag = blurbFragment(city.localBlurb);
    if (frag && !normHtml.includes(frag)) {
      failures.push('local blurb missing from page');
    }
  }
  // 9. Hero image alt embeds the city (image SEO).
  if (!normHtml.includes(normalizeText(`Research Peptides In ${city.name}`))) {
    failures.push('hero image alt does not embed the city');
  }
  // 10. Product card alt SEO (Top-10 card alt suffix). The city name is
  // covered by check 9; the stable prefix avoids punctuation pitfalls.
  const altCount = countOccurrences(html, 'Available To Researchers In');
  if (altCount < 8) {
    failures.push(`product card alt SEO missing (${altCount} occurrences, expected >= 8)`);
  }
  // 11. Hidden At A Glance fact block must remain in the HTML (it is
  // visually hidden by design - answer-engine content).
  if (!normHtml.includes('at a glance')) {
    failures.push('At A Glance fact block missing from HTML');
  } else if (city.zips && city.zips.length > 0 && !normHtml.includes('zip codes served')) {
    failures.push('At A Glance ZIP row missing from HTML');
  }
  // 12. Region wiring (region label renders in section headings).
  if (city.region && !normHtml.includes(normalizeText(city.region))) {
    failures.push(`region label "${city.region}" missing from page`);
  }
  // 13. FAQ content present.
  const detailsCount = countOccurrences(html, '<details');
  if (detailsCount < 3) {
    failures.push(`FAQ content missing (${detailsCount} details blocks, expected >= 3)`);
  }
  // 14. Meta description contains the city name. Attribute order varies by
  // renderer version, so accept name-first or content-first.
  const descMatch =
    html.match(/<meta[^>]*name="description"[^>]*content="([^"]*)"/i) ||
    html.match(/<meta[^>]*content="([^"]*)"[^>]*name="description"/i);
  if (!descMatch || !normalizeText(descMatch[1]).includes(normalizeText(city.name))) {
    failures.push('meta description missing or does not contain city name');
  }
  // 15. Per-city OG image (dynamic opengraph-image route) - warning only.
  if (!html.includes('opengraph-image')) {
    warnings.push('per-city OG image not referenced in og:image');
  }
  // Redirect check: final URL must still be the canonical city URL
  if (finalUrl && new URL(finalUrl).pathname !== new URL(url).pathname) {
    failures.push(`unexpected redirect to ${finalUrl}`);
  }

  return { failures, warnings };
}

async function verifyCity(city) {
  const url = `${BASE}/peptides/${city.stateSlug}/${city.slug}`;
  let lastError = null;
  for (let attempt = 0; attempt <= RETRIES; attempt++) {
    try {
      const res = await timeoutFetch(url);
      if (res.status !== 200) {
        lastError = `HTTP ${res.status}`;
        continue;
      }
      const html = await res.text();
      const { failures, warnings } = checkPage(city, html, res.url);
      if (failures.length === 0) {
        return { city, ok: true, warnings };
      }
      // ISR serves the STALE copy and regenerates in the background - wait
      // long enough (12s) for the background render before retrying, so a
      // content update in the current deploy is picked up on the retry.
      lastError = failures.join('; ');
      if (attempt < RETRIES) await new Promise((r) => setTimeout(r, 12000));
    } catch (err) {
      lastError = String(err?.message || err);
      if (attempt < RETRIES) await new Promise((r) => setTimeout(r, 2500));
    }
  }
  return { city, ok: false, error: lastError };
}

async function verifySitemap(cities) {
  const missing = [];
  try {
    const res = await timeoutFetch(`${BASE}/sitemap.xml`);
    if (res.status !== 200) return { ok: false, error: `sitemap HTTP ${res.status}`, missing };
    const xml = await res.text();
    for (const city of cities) {
      if (!xml.includes(`${BASE}/peptides/${city.stateSlug}/${city.slug}`)) {
        missing.push(`${city.stateSlug}/${city.slug}`);
      }
    }
    return { ok: missing.length === 0, missing };
  } catch (err) {
    return { ok: false, error: String(err?.message || err), missing };
  }
}

async function run() {
  const started = Date.now();
  const cities = selectCities();
  console.log(`Verifying ${cities.length} city pages against ${BASE} ...`);

  const queue = [...cities];
  const results = [];
  async function worker() {
    while (queue.length > 0) {
      const city = queue.shift();
      if (!city) break;
      results.push(await verifyCity(city));
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  const sitemap = await verifySitemap(cities);

  const failed = results.filter((r) => !r.ok);
  const warned = results.filter((r) => r.ok && r.warnings && r.warnings.length > 0);
  const byState = {};
  for (const r of results) {
    const s = r.city.stateSlug;
    byState[s] = byState[s] || { total: 0, ok: 0 };
    byState[s].total++;
    if (r.ok) byState[s].ok++;
  }

  const summary = {
    base: BASE,
    checkedAt: new Date().toISOString(),
    durationSeconds: Math.round((Date.now() - started) / 1000),
    totalCities: cities.length,
    passed: results.length - failed.length,
    failed: failed.length,
    warnings: warned.length,
    sitemapOk: sitemap.ok,
    sitemapMissingCount: sitemap.missing.length,
    byState: Object.fromEntries(
      Object.entries(byState)
        .sort()
        .map(([s, v]) => [s, `${v.ok}/${v.total}`])
    ),
    failures: failed.map((r) => ({
      city: `${r.city.name}, ${r.city.stateAbbr}`,
      url: `${BASE}/peptides/${r.city.stateSlug}/${r.city.slug}`,
      error: r.error,
    })),
    sitemapMissing: sitemap.missing.slice(0, 25),
  };

  // Machine-readable block for the workflow to lift into the GitHub issue.
  console.log('===CITY_HEALTH_JSON_START===');
  console.log(JSON.stringify(summary, null, 2));
  console.log('===CITY_HEALTH_JSON_END===');

  if (failed.length > 0 || !sitemap.ok) {
    console.error(`FAILED: ${failed.length} page(s) unhealthy, sitemapOk=${sitemap.ok}`);
    process.exit(1);
  }
  console.log(`ALL HEALTHY: ${results.length}/${cities.length} city pages pass the deep Oak Lawn checklist (15 checks per page).`);
}

run().catch((err) => {
  console.error('Verifier crashed:', err);
  process.exit(1);
});
