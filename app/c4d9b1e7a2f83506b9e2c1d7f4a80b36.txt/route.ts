/**
 * IndexNow key verification endpoint.
 *
 * Served as an explicit App Router route (not a /public static file) because
 * the storefront's root dynamic segment `[agentSlug]` catches single-segment
 * paths like /<key>.txt. A literal/defined route segment takes precedence over
 * a dynamic segment in Next.js routing, so this reliably serves the key to
 * IndexNow's ownership verifier. This key is fresh (never previously requested)
 * so its URL is not affected by any stale CDN cache entry.
 *
 * The response body is exactly the key (matching the filename), per the
 * IndexNow spec.
 */

export const dynamic = 'force-static';

const KEY = 'c4d9b1e7a2f83506b9e2c1d7f4a80b36';

export function GET() {
  return new Response(KEY, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
