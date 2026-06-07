// Omega-Protocol: Article Proxy Utils
// Caches, Pre-warms, and Platform Bypass Utilities

const MAX_CACHE_ENTRIES = 200;

// LRU cache for prewarmed URLs
const _prewarmedUrls = new Set<string>();

// Domains that should skip pre-warming entirely
const PROXY_SKIP_DOMAINS = [
  'facebook.com',
  'twitter.com',
  'x.com',
  'tiktok.com',
  'instagram.com',
  'linkedin.com',
  'youtube.com',
  'youtu.be',
  'vimeo.com',
];

/**
 * Pre-warms the proxy in the background silently.
 * Uses priority: 'low' and credentials: 'omit' to prevent bandwidth contention.
 */
export function prewarmProxy(url: string | null | undefined) {
  if (!url || typeof window === 'undefined') return;

  try {
    const parsed = new URL(url);
    if (PROXY_SKIP_DOMAINS.some(domain => parsed.hostname.includes(domain))) {
      return;
    }

    if (_prewarmedUrls.has(url)) return;

    // Maintain LRU size
    if (_prewarmedUrls.size >= MAX_CACHE_ENTRIES) {
      const first = _prewarmedUrls.values().next().value;
      _prewarmedUrls.delete(first);
    }

    _prewarmedUrls.add(url);

    // Silent background fetch
    fetch(`/api/proxy?url=${encodeURIComponent(url)}`, {
      method: 'GET',
      priority: 'low',
      credentials: 'omit',
    } as any).catch(() => {});
  } catch (e) {
    // Invalid URL or fetch error, ignore silently
  }
}

/**
 * Determines if a URL belongs to a social platform that actively blocks proxies.
 * These should bypass the iframe modal and use window.open directly.
 */
export function isSocialPlatformUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return PROXY_SKIP_DOMAINS.some(domain => parsed.hostname.includes(domain));
  } catch (e) {
    return false;
  }
}
