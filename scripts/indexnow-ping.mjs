/**
 * IndexNow ping — instantly notifies Bing (and other IndexNow engines) about
 * new or updated URLs instead of waiting weeks for a crawl. Bing powers
 * ChatGPT search and much of the AI-search ecosystem, so fast Bing indexation
 * directly improves "recommended by AI" visibility.
 *
 * Key file: public/dd1cadb2f24baad9100bb82b2f86bc8e.txt (served at the site root).
 *
 * Usage:
 *   node scripts/indexnow-ping.mjs                    # pings every URL in the live sitemap
 *   node scripts/indexnow-ping.mjs <url> [<url> ...]  # pings specific URLs
 *
 * Run after any deploy that adds or changes public pages (e.g. as a Vercel
 * post-deploy hook or manually).
 */

const HOST = 'pepnationlab.com';
const KEY = 'dd1cadb2f24baad9100bb82b2f86bc8e';
const ENDPOINT = 'https://api.indexnow.org/indexnow';
const BATCH = 500;

async function urlsFromSitemap() {
  const res = await fetch(`https://${HOST}/sitemap.xml`);
  if (!res.ok) throw new Error(`sitemap fetch failed: ${res.status}`);
  const xml = await res.text();
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
}

async function ping(urlList) {
  for (let i = 0; i < urlList.length; i += BATCH) {
    const chunk = urlList.slice(i, i + BATCH);
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        host: HOST,
        key: KEY,
        keyLocation: `https://${HOST}/${KEY}.txt`,
        urlList: chunk,
      }),
    });
    console.log(`IndexNow batch ${i / BATCH + 1}: ${chunk.length} URLs -> HTTP ${res.status}`);
    if (!res.ok && res.status !== 202) {
      console.error(await res.text());
      process.exitCode = 1;
    }
  }
}

const args = process.argv.slice(2);
const urls = args.length > 0 ? args : await urlsFromSitemap();
console.log(`Pinging IndexNow with ${urls.length} URL(s)...`);
await ping(urls);
