// Pep Nation Lab service worker - web push receiver, offline caching, and IndexedDB replication.
const CACHE_VERSION = 'pnl-sw-v3';
const STATIC_CACHE_NAME = 'pnl-static-cache-v3';
const DYNAMIC_CACHE_NAME = 'pnl-dynamic-cache-v3';

// ---------------------------------------------------------------------
// WEB PUSH NOTIFICATION HANDLERS
// ---------------------------------------------------------------------

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

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
      const aliases = (c.aliases || []).map(a => a.toLowerCase());
      const areas = (c.research_areas || []).map(a => a.toLowerCase());
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
// FETCH INTERCEPTION & CACHING STRATEGY
// ---------------------------------------------------------------------

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. Compounds list: Network-first, write to IndexedDB, fallback to DB
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

  // 2. Search API: Network-first, fallback to IndexedDB local query
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

  // 3. Stale-While-Revalidate for static assets & pages
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
        const fetchPromise = fetch(event.request).then((networkResponse) => {
          if (networkResponse.ok) {
            caches.open(STATIC_CACHE_NAME).then((cache) => {
              cache.put(event.request, networkResponse.clone());
            });
          }
          return networkResponse;
        }).catch(() => null);

        return cachedResponse || fetchPromise;
      })
    );
    return;
  }
});
