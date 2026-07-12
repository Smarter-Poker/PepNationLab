# Caching Strategy Sweep - 2026-07-12

Full-platform caching audit and implementation for pepnationlab.com, executed by a
six-agent analysis swarm (pages/routes, data/API, catalog, user-data safety,
invalidation, CDN/static) with adversarial risk review, followed by implementation,
a clean production build (303/303 pages), and a green test suite (195/195).

## How To Apply (read first)

This work is delivered as `caching-sweep.patch` (46 files, caching-only deltas:
59 revalidateTag calls, 22 Cache-Control headers, 6 revalidate exports). It is a
patch rather than a direct file write because ANOTHER session was actively editing
the same repo during this run (schema hardening, validation bounds, audit logging,
and a live rewrite of app/api/orders/route.ts). Force-writing whole files would have
clobbered that concurrent work. The patch was verified to apply cleanly on top of the
current device state (fuzz/offset only, zero rejected hunks).

From the repo root:

    git apply --3way caching-sweep.patch     # preferred (3-way merge)
    # or, if not a clean git tree:
    patch -p1 --fuzz=3 < caching-sweep.patch

Then follow the CLAUDE.md ship rule: commit under the Smarter-Poker identity and push
to main (Vercel auto-deploys). No SQL migration is required - every change is code-only.
Note: this cloud session cannot push (the device bridge has no network and the cloud
container has no repo credentials), so the commit + push is the one step that must run
on your machine.

Correctness rule enforced throughout: price, inventory, and order data freshness is
never traded for speed. Checkout re-derives every price server-side from
pricing_tiers / agent_products / flash_sales / product_tier_overrides and re-reserves
inventory atomically (app/api/orders/route.ts), so DISPLAY caching is bounded-risk;
MONEY paths remain fully live.

---

## 1. What Was Found (Opportunity Map)

- Server-side cache invalidation was effectively absent: exactly ONE mutation route
  in the whole repo (admin/research/intranasal) called revalidateTag. Every
  catalog-affecting mutation (admin product CRUD, tier multipliers, overrides, flash
  sales, agent price/inventory/theme/slug/bundle edits, order-time inventory
  deduction, COA rotation) shipped stale catalog data for up to ~15 minutes
  (5 min edge + 10 min client localStorage).
- The compounds Data Cache (lib/compounds-server.ts) used revalidate: 60, which
  dragged the effective ISR window of ~24 research pages down to 1 MINUTE - they
  were being re-rendered against Supabase every 60s for data that changes weekly.
- Five public research pages (references / structure / regulatory tabs, correlated,
  by-target/[target]) were force-dynamic despite reading only public cron-refreshed
  tables - full render + DB round-trip on every hit.
- sitemap.xml regenerated thousands of URLs + up to three 2000-row Supabase queries
  on EVERY crawler hit (no revalidate).
- Public research APIs (compounds-list, search GET, instant-answer, widget) and
  feed.xml had no or browser-only cache headers - every hit paid a full Supabase
  round-trip at the origin.
- The storefront catalog API used the cookie-aware Supabase client under a `public`
  CDN header - safe today, but one refactor away from baking per-user data into a
  shared cache.
- Authed money/PII GET routes (researcher orders, addresses, invoices, wallet,
  notifications) relied on implicit dynamic rendering with no explicit
  private/no-store header (the messenger/admin family already set it).
- Client polling: support-inbox polled every 60s alongside a realtime subscription;
  presence pinged every 30s even from hidden tabs.

No live cross-user cache leak existed. No stale-money bug existed. Both were
verified by dedicated adversarial passes.

## 2. What Was Implemented

### Invalidation infrastructure (the big one)
- app/api/storefront/catalog/[agentSlug]/route.ts: payload assembly moved into
  unstable_cache keyed by slug with tags ['storefront-catalog', 'catalog:<slug>'],
  revalidate 120s; switched to the service-role client (cookie-free by construction,
  so personalization is structurally impossible under the public header); edge header
  tightened from s-maxage=300/swr=600 to s-maxage=60/swr=300 so purges surface fast.
  Transient DB errors are thrown (never cached); not-found/paused are cacheable
  discriminated results.
- revalidateTag('storefront-catalog') added on the success path of every
  catalog-affecting mutation (18 routes): agent products (edit/bulk-margin/reorder),
  agent inventory, admin products (create/update/bulk-price-apply/lots/COA),
  pricing tiers + overrides, flash sales (create/update/delete), storefront config
  (theme/name/bundles), storefront-slug (busts old AND new slug tags), order
  placement (after inventory deduction), and rotate-coas cron. Worst-case catalog
  staleness after any mutation drops from ~15 min to <=60s at the edge (and seconds
  for on-page shoppers via the existing Supabase Realtime eviction, whose forced
  refetch now carries a CDN cache-buster).
- Compound-writing crons (pubmed-sync, chembl-sync, search-refresh) now bust the
  'compounds' (and 'bindings') tags they invalidate.

### Route caching / ISR
- lib/compounds-server.ts: revalidate 60 -> 3600 (tag-purged by the writers above).
  Effective ISR for ~24 research/catalog pages went from 1m to 1h.
- Five public research pages converted from force-dynamic to ISR (revalidate 3600)
  using the repo-proven pattern: queries wrapped in unstable_cache with the
  service client constructed inside, supabaseEnvReady() guard for env-less builds
  (Vercel Preview), tagged 'compounds'/'bindings'/'structures'.
- app/sitemap.ts: revalidate 3600.

### API / CDN headers
- public research GETs now edge-cached: compounds-list (s-maxage=300/swr=600),
  search GET only (300/1800; POST untouched), instant-answer (120/600),
  widget/[slug] (s-maxage=600/swr=3600), member-count normalized (300/600).
- feed.xml, llms.txt, llms-full.txt: proper s-maxage + stale-while-revalidate.
- next.config.ts: cache headers for logo.svg / logo-mark.svg / payment-logos
  (max-age=86400 + swr, deliberately NOT immutable - names are not content-hashed);
  sw.js and sw-register.js pinned to max-age=0, must-revalidate.

### Safety hardening (DELTA findings)
- Explicit 'Cache-Control: private, no-store' + force-dynamic on the authed
  money/PII GET family: researcher/orders, account/addresses, invoices, wallet,
  account/notifications/feed - matching the messenger/admin convention.
- Support-inbox poll relaxed 60s -> 300s (realtime is primary; poll is a
  disconnect fallback). Presence ping 30s -> 60s, skipped while document.hidden,
  immediate ping on tab re-focus.

## 3. What Must NEVER Be Cached (unchanged, verified live)
- Checkout pricing reads, inventory reservation, orders, statements, balances,
  wallet, messenger, admin - all remain fully dynamic (most now with explicit
  no-store).
- Agent storefront page (app/[agentSlug]/page.tsx) stays force-dynamic live SSR:
  it renders viewer-specific pricing (owner cost, tier), wishlist, and auth state.
- /api/research/products and the API-key public/v1/* routes: user/key-scoped
  despite public-looking paths - deliberately left uncached.

## 4. Verification
- npx tsc --noEmit: clean (only pre-existing errors in the stray root scratch file
  map_body.tsx, untouched).
- next build: exit 0, 303/303 static pages generated. Route-table diff vs the
  pre-change build shows EXACTLY the intended deltas and nothing else.
- npm test: 20 files, 195/195 passing.
- Baseline perf (lh-report 2026-07-10, mobile home): perf 0.99, LCP 2.0s, TTFB 30ms.

## 5. Expected Impact
- Research surface (biggest DB-load win): per-page Supabase reads drop ~60x
  (1m -> 1h windows) and five always-dynamic pages become cached HTML.
- Storefront catalog: correct-by-construction freshness (tag purge on every
  mutation) while keeping edge/browser/localStorage warm paths; origin DB reads
  for the catalog drop by the unstable_cache hit rate.
- Crawler/AI traffic (sitemap, feed, llms.txt, widgets): moved from origin
  Supabase scans to edge hits.
- Serverless invocations reduced by polling changes (support inbox 5x fewer,
  presence 2x fewer + zero from hidden tabs).

## 6. Remaining Risks / Follow-ups
1. agent_profiles.is_active toggling (pause/unpause) is not tag-busted: a paused or
   unpaused store can serve its previous catalog state for up to ~120s origin +
   60s edge. Bounded; add a bust to the admin agent-activation route if desired.
2. The global 'storefront-catalog' tag purges all stores on any single store's
   edit - cheap at current scale (revalidate 120 rebuild), per-slug tags are
   already attached if finer busting is ever wanted.
3. The client localStorage catalog cache (10 min TTL) is unreachable by server
   tags by design; Realtime eviction covers interactive sessions. A DB-owned
   catalog_version echoed in the payload would close the gap fully (not needed now).
4. /api/proxy intentionally caches proxied PUBLIC external pages (s-maxage=300)
   behind an auth gate; keep upstreams non-personalized or switch to no-store.
5. map_body.tsx (root scratch file) fails tsc and should be deleted from the repo.
