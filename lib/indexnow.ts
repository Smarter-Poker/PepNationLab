/**
 * IndexNow - instant URL submission to Bing, Yandex, Seznam, and other
 * IndexNow-participating search engines (Bing also powers ChatGPT search
 * results, so this shortens the time-to-discovery for AI answer engines).
 *
 * Setup:
 *  - The key is published at https://pepnationlab.com/<KEY>.txt (see the file
 *    of that name in /public). IndexNow validates ownership against it.
 *  - Call pingIndexNow([...urls]) whenever content is created or updated
 *    (e.g. after publishing a new compound monograph or city page), or hit
 *    the /api/seo/indexnow route from a cron job.
 *
 * Only URLs on the canonical host are submitted; anything else is ignored so
 * we never submit URLs we do not own.
 */

export const INDEXNOW_KEY = '8f2b1c9d4e6a7035b1c8d2e9f0a3b4c5';
const HOST = 'pepnationlab.com';

export async function pingIndexNow(urls: string[]): Promise<{ ok: boolean; status: number; submitted: number }> {
  const urlList = Array.from(
    new Set((urls ?? []).map((u) => (u ?? '').trim()).filter((u) => u.startsWith(`https://${HOST}`)))
  );
  if (urlList.length === 0) return { ok: false, status: 0, submitted: 0 };

  try {
    const res = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        host: HOST,
        key: INDEXNOW_KEY,
        keyLocation: `https://${HOST}/${INDEXNOW_KEY}.txt`,
        urlList,
      }),
    });
    return { ok: res.ok, status: res.status, submitted: urlList.length };
  } catch {
    return { ok: false, status: 0, submitted: 0 };
  }
}
