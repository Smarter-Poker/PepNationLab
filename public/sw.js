// Pep Nation Lab service worker - web push receiver, offline caching, and IndexedDB replication.
// v4: Added catalog API caching and Supabase storage image caching.
const CACHE_VERSION = 'pnl-sw-v4';
const STATIC_CACHE_NAME = 'pnl-static-cache-v4';
const DYNAMIC_CACHE_NAME = 'pnl-dynamic-cache-v4';
const CATALOG_CACHE_NAME = 'pnl-catalog-cache-v4';
const IMAGE_CACHE_NAME = 'pnl-image-cache-v4';

// Catalog cache TTL in the service worker (5 min = 300,000 ms)
// Matches the s-maxage set on the API route's Cache-Control header.
const CATALOG_SW_TTL_MS = 5 * 60 * 1000;
// Product images from Supabase storage are considered immutable — 7 day cache
const IMAGE_SW_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------
// INSTALL & ACTIVATE — Clean up old caches
// ---------------------------------------------------------------------

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  const keepCaches = new Set([
    STATIC_CACHE_NAME,
    DYNAMIC_CACHE_NAME,
    CATALOG_CACHE_NAME,
    IMAGE_CACHE_NAME,
  ]);
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => !keepCaches.has(k)).map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ---------------------------------------------------------------------
// WEB PUSH NOTIFICATION HANDLERS
// ---------------------------------------------------------------------

self.addEventListener('push', (event) => {
  if (!event.data) return;
  let data = {};
  try {
    data = event.data.json();
  } catch (_) {
    data = { title: 'Pep Nation Lab', body: event.data.text() };
  }

  const title = data.title || 'Pep Nation Lab';
  const options = {
    body: data.body || '',
    icon: data.icon || '/logo-mark.svg',
    badge: data.badge || '/logo-mark.svg',
    data: { url: data.url || '/' },
    tag: data.tag,
    renotify: data.renotify === undefined ? true : !!data.renotify,
    silent: false,
    vibrate: Array.isArray(data.vibrate) && data.vibrate.length ? data.vibrate : [120, 60, 120],
    requireInteraction: !!data.requireInteraction,
    actions: Array.isArray(data.actions) ? data.actions.slice(0, 2) : undefined,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'decline') return;

  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const c of clients) {
        if ('focus' in c) {
          c.focus();
          if ('navigate' in c && url && !c.url.includes(url)) {
            try { c.navigate(url); } catch (_) {}
          }
          return;
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});

// ---------------------------------------------------------------------
// INDEXEDDB LOCAL REPLICATION & OFFLINE SEARCH
// ---------------------------------------------------------------------

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('pepnation-db', 1);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('compounds')) {
        db.createObjectStore('compounds', { keyPath: 'slug' });
      }
    };
    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = (e) => reject(e.target.error);
  });
}

function saveCompoundsToDB(compounds) {
  return openDB().then((db) => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction('compounds', 'readwrite');
      const store = tx.objectStore('compounds');
      
      const clearReq = store.clear();
      clearReq.onsuccess = () => {
        for (const compound of compounds) {
          store.put(compound);
        }
      };
      
      tx.oncomplete = () => resolve();
      tx.onerror = (e) => reject(e.target.error);
    });
  });
}

function getCompoundsFromDB() {
  return openDB().then((db) => {
    return new Promise((resolve, reject) => {
      const tx = db.transaction('compounds', 'readonly');
      const store = tx.objectStore('compounds');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = (e) => reject(e.target.error);
    });
  });
}

async function searchOffline(queryStr) {
  try {
    const compounds = await getCompoundsFromDB();
    const q = queryStr.toLowerCase().trim();
    
    if (!q) {
      return { results: [], total: 0, latencyMs: 0, note: "Offline Mode. Stored laboratory data.", filters_applied: [] };
    }

    const results = compounds.filter(c => {
      const displayName = (c.display_name || '').toLowerCase();
      const slug = (c.slug || '').toLowerCase();
      const aliases = (Array.isArray(c.aliases) ? c.aliases : []).map(a => a.toLowerCase());
      const areas = (Array.isArray(c.research_areas) ? c.research_areas : []).map(a => a.toLowerCase());
      const category = (c.category || '').toLowerCase();

      return (
        displayName.includes(q) ||
        slug.includes(q) ||
        aliases.some(a => a.includes(q)) ||
        areas.some(a => a.includes(q)) ||
        category.includes(q)
      );
    }).map(c => ({
      slug: c.slug,
      display_name: c.display_name,
      evidence_tier: c.evidence_tier || 'moderate',
      wada_status: c.wada_status || 'not_listed',
      snippet: c.plain_summary || '',
      score: 1.0,
      knowledge_panel_url: `/research/compounds/${c.slug}`
    }));

    return {
      results,
      total: results.length,
      latencyMs: 1,
      note: "Offline Mode Search. Stored laboratory data.",
      filters_applied: []
    };
  } catch (err) {
    console.error('Offline search failed:', err);
    return { results: [], total: 0, latencyMs: 0, note: "Offline Mode Search Failed.", filters_applied: [] };
  }
}

// ---------------------------------------------------------------------
// CATALOG CACHE HELPERS
// Helper to check if a cached Response is still within TTL.
// We store the fetch timestamp as a custom header on the cached response.
// ---------------------------------------------------------------------

async function getCatalogFromCache(cacheName, request) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (!cached) return null;

  const fetchedAt = cached.headers.get('x-pnl-cached-at');
  if (!fetchedAt) return null;

  const age = Date.now() - parseInt(fetchedAt, 10);
  if (age > CATALOG_SW_TTL_MS) {
    // Stale — return it anyway (stale-while-revalidate) but signal it's stale
    return { response: cached, stale: true };
  }
  return { response: cached, stale: false };
}

async function putCatalogInCache(cacheName, request, response) {
  if (!response.ok) return;
  const cache = await caches.open(cacheName);
  // Clone and add our timestamp header
  const headers = new Headers(response.headers);
  headers.set('x-pnl-cached-at', String(Date.now()));
  const augmented = new Response(response.clone().body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
  await cache.put(request, augmented);
}

// ---------------------------------------------------------------------
// FETCH INTERCEPTION & CACHING STRATEGY
// ---------------------------------------------------------------------

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // ── A. Catalog API — stale-while-revalidate, 5 min TTL ──────────────────────
  // /api/storefront/catalog/[agentSlug]
  if (
    event.request.method === 'GET' &&
    url.pathname.startsWith('/api/storefront/catalog/')
  ) {
    event.respondWith(
      getCatalogFromCache(CATALOG_CACHE_NAME, event.request).then((cached) => {
        if (cached) {
          // Always fire a background revalidation
          event.waitUntil(
            fetch(event.request.clone()).then((networkResponse) => {
              if (networkResponse.ok) {
                putCatalogInCache(CATALOG_CACHE_NAME, event.request, networkResponse.clone());
              }
            }).catch(() => {})
          );
          // Serve stale immediately
          return cached.response;
        }

        // No cache — wait for network
        return fetch(event.request).then((networkResponse) => {
          if (networkResponse.ok) {
            putCatalogInCache(CATALOG_CACHE_NAME, event.request, networkResponse.clone());
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // ── B. Storefront recommendations — cache-first, 2 min TTL ─────────────────
  if (
    event.request.method === 'GET' &&
    url.pathname.startsWith('/api/storefront/recommendations')
  ) {
    event.respondWith(
      caches.open(DYNAMIC_CACHE_NAME).then((cache) =>
        cache.match(event.request).then((cached) => {
          if (cached) {
            // Revalidate in background
            fetch(event.request.clone()).then((r) => {
              if (r.ok) cache.put(event.request, r.clone());
            }).catch(() => {});
            return cached;
          }
          return fetch(event.request).then((r) => {
            if (r.ok) cache.put(event.request, r.clone());
            return r;
          });
        })
      )
    );
    return;
  }

  // ── C. Compounds list — network-first, write to IndexedDB ───────────────────
  if (url.pathname === '/api/research/compounds-list') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            clone.json().then((data) => {
              if (data && Array.isArray(data.compounds)) {
                saveCompoundsToDB(data.compounds).catch((err) =>
                  console.error('IndexedDB save failed:', err)
                );
              }
            }).catch(() => {});
            
            caches.open(DYNAMIC_CACHE_NAME).then((cache) => {
              cache.put(event.request, response.clone());
            });
          }
          return response;
        })
        .catch(() => {
          return caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) return cachedResponse;
            
            return getCompoundsFromDB().then((compounds) => {
              return new Response(JSON.stringify({ compounds }), {
                headers: { 'Content-Type': 'application/json' },
              });
            });
          });
        })
    );
    return;
  }

  // ── D. Research search — network-first, offline fallback ────────────────────
  if (url.pathname === '/api/research/search') {
    event.respondWith(
      fetch(event.request)
        .catch(() => {
          const q = url.searchParams.get('q') || '';
          return searchOffline(q).then((searchResult) => {
            return new Response(JSON.stringify(searchResult), {
              headers: { 'Content-Type': 'application/json' },
            });
          });
        })
    );
    return;
  }

  // ── E. Supabase product images — cache-first, 7 day TTL ─────────────────────
  // These are immutable (content-addressed by storage key) so long caching is safe.
  const isSupabaseImage =
    (url.hostname.includes('.supabase.co') || url.hostname.includes('.supabase.in')) &&
    url.pathname.includes('/storage/v1/object/public/');

  if (event.request.method === 'GET' && isSupabaseImage) {
    event.respondWith(
      caches.open(IMAGE_CACHE_NAME).then((cache) =>
        cache.match(event.request).then((cached) => {
          if (cached) {
            // Check age
            const cachedAt = cached.headers.get('x-pnl-cached-at');
            const age = cachedAt ? Date.now() - parseInt(cachedAt, 10) : Infinity;
            if (age < IMAGE_SW_TTL_MS) return cached;
          }
          // Fetch and cache
          return fetch(event.request).then((response) => {
            if (response.ok && response.status === 200) {
              const headers = new Headers(response.headers);
              headers.set('x-pnl-cached-at', String(Date.now()));
              const augmented = new Response(response.clone().body, {
                status: response.status,
                statusText: response.statusText,
                headers,
              });
              cache.put(event.request, augmented);
            }
            return response;
          }).catch(() => cached || new Response('', { status: 503 }));
        })
      )
    );
    return;
  }

  // ── F. Static assets & research pages — stale-while-revalidate ──────────────
  const isStaticAsset = 
    url.pathname.includes('/_next/') || 
    url.pathname.startsWith('/fonts/') || 
    url.pathname.startsWith('/images/') || 
    url.pathname.endsWith('.js') || 
    url.pathname.endsWith('.css') || 
    url.pathname.endsWith('.png') || 
    url.pathname.endsWith('.svg') || 
    url.pathname.endsWith('.ico');

  const isResearchPage = url.pathname.startsWith('/research');

  if (event.request.method === 'GET' && (isStaticAsset || isResearchPage)) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          // Update cache in the background
          event.waitUntil(
            fetch(event.request).then((networkResponse) => {
              if (networkResponse.ok) {
                caches.open(STATIC_CACHE_NAME).then((cache) => {
                  cache.put(event.request, networkResponse.clone());
                });
              }
            }).catch(() => {})
          );
          return cachedResponse;
        }

        // No cache — wait for network
        return fetch(event.request).then((networkResponse) => {
          if (networkResponse.ok) {
            caches.open(STATIC_CACHE_NAME).then((cache) => {
              cache.put(event.request, networkResponse.clone());
            });
          }
          return networkResponse;
        });
      })
    );
    return;
  }
});
