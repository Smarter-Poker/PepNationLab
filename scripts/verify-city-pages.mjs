/**
 * scripts/verify-city-pages.mjs
 *
 * Automated city landing page health verifier. Fetches EVERY city page on
 * production and asserts the full "Oak Lawn checklist" against each one:
 *
 *   1. HTTP 200
 *   2. <meta name="robots"> allows indexing (index, follow)
 *   3. Canonical URL is exact and self-referencing
 *   4. <title> and <h1> contain the city name
 *   5. JSON-LD present: Service, BreadcrumbList (ItemList when the live
 *      storefront Top 10 loaded)
 *   6. Live storefront Top 10 rendered (>= 10 deep links into the store,
 *      proving live data, not the static fallback)
 *   7. Local content present: county, first ZIP, and local blurb fragment
 *      (when the city record has them)
 *   8. Every city URL is present in sitemap.xml
 *
 * Zero dependencies (global fetch, Node 22+). City data is imported straight
 * from lib/cities/cities-data.ts via --experimental-strip-types so the check
 * list can NEVER drift from the deployed city set.
 *
 * Run:  node --experimental-strip-types scripts/verify-city-pages.mjs
 * Exit: 0 all pages healthy, 1 any failure (fails the CI job loudly).
 *
 * Wired to .github/workflows/city-pages-verify.yml (daily cron). Results are
 * posted to the pinned "City Pages Health Report" GitHub issue by the
 * workflow, so agents and humans can read status without any dashboard.
 */

import { CITIES } from '../lib/cities/cities-data.ts';

const BASE = process.env.VERIFY_BASE_URL || 'https://pepnationlab.com';
const CONCURRENCY = 8;
const RETRIES = 2; // ISR cold pages can be slow on first hit; retry before failing
const FETCH_TIMEOUT_MS = 30000;

function timeoutFetch(url, ms = FETCH_TIMEOUT_MS) {
  return fetch(url, {
    redirect: 'follow',
    signal: AbortSignal.timeout(ms),
    headers: {
      'User-Agent':
        'PepNationLab-CityPageVerifier/1.0 (+https://pepnationlab.com; automated health check)',
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
 * and the expected content fragments. Curly quotes, apostrophes (raw or
 * HTML-escaped), hyphens, and em dashes all collapse to single spaces, so
 * copy-editing passes (quote curling, em dash stripping) and React's entity
 * escaping can never cause false failures. First run false-positived on 32
 * cities whose blurbs contain apostrophes or hyphens in the opening words
 * ("Schaumburg's Woodfield", "The third-largest city") - hence this.
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

function checkPage(city, html, finalUrl) {
  const url = `${BASE}/peptides/${city.stateSlug}/${city.slug}`;
  const failures = [];
  const warnings = [];

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
  const escapedName = htmlEscape(city.name);
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
    if (!html.includes('"@type":"ItemList"')) {
      // ItemList only renders when the live Top 10 loaded; treat with #6.
      warnings.push('ItemList schema missing (live Top 10 may not have loaded)');
    }
  }
  // 6. Live storefront Top 10 (deep links prove live data, not fallback)
  const productLinks = (html.match(/researchstore\?product=/g) || []).length;
  if (productLinks < 10) {
    failures.push(`live Top 10 not rendered (${productLinks} store deep links, expected >= 10)`);
  }
  // 7. Local content - compared on normalized text so punctuation and
  // entity-escaping differences can never produce false failures.
  const normHtml = normalizeText(html);
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
      // Content failures on a cold ISR page can heal on regeneration; retry once.
      lastError = failures.join('; ');
      if (attempt < RETRIES) await new Promise((r) => setTimeout(r, 2500));
    } catch (err) {
      lastError = String(err?.message || err);
      if (attempt < RETRIES) await new Promise((r) => setTimeout(r, 2500));
    }
  }
  return { city, ok: false, error: lastError };
}

async function verifySitemap() {
  const missing = [];
  try {
    const res = await timeoutFetch(`${BASE}/sitemap.xml`);
    if (res.status !== 200) return { ok: false, error: `sitemap HTTP ${res.status}`, missing };
    const xml = await res.text();
    for (const city of CITIES) {
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
  console.log(`Verifying ${CITIES.length} city pages against ${BASE} ...`);

  const queue = [...CITIES];
  const results = [];
  async function worker() {
    while (queue.length > 0) {
      const city = queue.shift();
      if (!city) break;
      results.push(await verifyCity(city));
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  const sitemap = await verifySitemap();

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
    totalCities: CITIES.length,
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
  console.log(`ALL HEALTHY: ${results.length}/${CITIES.length} city pages pass the Oak Lawn checklist.`);
}

run().catch((err) => {
  console.error('Verifier crashed:', err);
  process.exit(1);
});
