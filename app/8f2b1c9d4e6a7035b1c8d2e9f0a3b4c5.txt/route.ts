/**
 * IndexNow key verification endpoint.
 *
 * Served as an explicit App Router route (not a /public static file) because
 * the storefront's root dynamic segment `[agentSlug]` was catching the
 * single-segment path /<key>.txt and rendering "Store Not Found" before the
 * static file could be served. A literal/defined route segment takes
 * precedence over a dynamic segment in Next.js routing, so this guarantees the
 * key is served to IndexNow's ownership verifier.
 *
 * The response body is exactly the key (matching the filename), per the
 * IndexNow spec.
 */

export const dynamic = 'force-static';

const KEY = '8f2b1c9d4e6a7035b1c8d2e9f0a3b4c5';

export function GET() {
  return new Response(KEY, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
