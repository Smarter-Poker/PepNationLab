/**
 * Storefront Catalog Cache - Client-Side localStorage + Service Worker helpers.
 *
 * Implements a stale-while-revalidate pattern for the AgentStorefrontGrid:
 *   1. On first mount, read from localStorage (instant render if cache is fresh).
 *   2. Always fetch fresh data from /api/storefront/catalog/[agentSlug].
 *   3. When fresh data arrives, write back to localStorage and update React state.
 *
 * The catalog payload contains non-personalized, non-sensitive data:
 *   products, inventory (approximate), COA URLs, compound research data.
 *
 * USER-SPECIFIC data (wishlist IDs, agent-owner cost prices) is always server-rendered
 * and never stored in this cache.
 */

import type { Compound } from '@/lib/compounds';

// ─── Cache Config ──────────────────────────────────────────────────────────────

/** Bump this version when the shape of CatalogPayload changes. */
export const CATALOG_CACHE_VERSION = 'v2';

/** How long a cached catalog is considered "fresh" on the client (10 min). */
export const CATALOG_TTL_MS = 10 * 60 * 1000;

/** Max bytes for the JSON payload before we skip localStorage (4 MB safety margin). */
const CATALOG_MAX_BYTES = 4 * 1024 * 1024;

function cacheKey(agentSlug: string): string {
  return `pnl_catalog_${CATALOG_CACHE_VERSION}_${agentSlug}`;
}

// ─── Payload Types ─────────────────────────────────────────────────────────────

/** One product variant as stored in the catalog cache. */
export interface CatalogProduct {
  id: string;
  product_id: string;
  custom_name: string | null;
  custom_description: string | null;
  custom_image_url: string | null;
  retail_price: number;
  is_on_sale: boolean;
  sale_price: number | null;
  products: {
    name: string;
    description: string;
    image_url: string | null;
    category: string;
    backorder_days: number;
    unit_size: string | null;
    unit_measure: string | null;
    weight_oz: number | null;
    inventory_count: number | null;
    low_stock_threshold: number | null;
    compound_slug: string | null;
    admin_bulk_price?: number | null;
  };
}

/** Full catalog payload returned by /api/storefront/catalog/[agentSlug]. */
export interface StorefrontCatalogPayload {
  agentSlug: string;
  primaryColor: string;
  products: CatalogProduct[];
  inventoryMap: Record<string, number>;
  coaByProductId: Record<string, string>;
  compoundsBySlug: Record<string, Compound>;
  fetchedAt: number; // unix ms timestamp
}

/** What gets stored in localStorage - the payload plus a version tag. */
interface CachedEntry {
  version: string;
  payload: StorefrontCatalogPayload;
}

// ─── Read ──────────────────────────────────────────────────────────────────────

/**
 * Read the cached catalog for the given agent slug.
 * Returns null if:
 *   - Not in localStorage
 *   - Version mismatch (schema changed)
 *   - Cache is older than CATALOG_TTL_MS
 *   - Any parse error
 */
export function readCatalogCache(agentSlug: string): StorefrontCatalogPayload | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(cacheKey(agentSlug));
    if (!raw) return null;
    const entry: CachedEntry = JSON.parse(raw);
    if (entry?.version !== CATALOG_CACHE_VERSION) return null;
    const payload = entry?.payload;
    if (!payload || typeof payload.fetchedAt !== 'number') return null;
    // Allow stale data to be shown but flag it as expired for background refresh
    return payload;
  } catch {
    return null;
  }
}

/**
 * Returns true if the cached payload is still within CATALOG_TTL_MS.
 */
export function isCatalogCacheFresh(payload: StorefrontCatalogPayload): boolean {
  return Date.now() - payload.fetchedAt < CATALOG_TTL_MS;
}

// ─── Write ─────────────────────────────────────────────────────────────────────

/**
 * Write a catalog payload to localStorage.
 * Silently skips if the serialised payload exceeds CATALOG_MAX_BYTES to
 * avoid filling up the 5 MB localStorage quota.
 */
export function writeCatalogCache(agentSlug: string, payload: StorefrontCatalogPayload): void {
  if (typeof window === 'undefined') return;
  try {
    const entry: CachedEntry = { version: CATALOG_CACHE_VERSION, payload };
    const serialised = JSON.stringify(entry);
    if (serialised.length > CATALOG_MAX_BYTES) {
      console.warn('[PNL] Catalog cache payload too large - skipping localStorage write');
      return;
    }
    localStorage.setItem(cacheKey(agentSlug), serialised);
  } catch (e) {
    // QuotaExceededError - silently swallow
    console.warn('[PNL] localStorage write failed:', e);
  }
}

// ─── Evict ─────────────────────────────────────────────────────────────────────

/** Remove the cached catalog for a slug. Useful for forced refresh. */
export function evictCatalogCache(agentSlug: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(cacheKey(agentSlug));
  } catch {
    // ignore
  }
}

/** Evict all catalog caches across all agent slugs (e.g. on logout). */
export function evictAllCatalogCaches(): void {
  if (typeof window === 'undefined') return;
  try {
    const prefix = `pnl_catalog_${CATALOG_CACHE_VERSION}_`;
    const keys = Object.keys(localStorage).filter((k) => k.startsWith(prefix));
    keys.forEach((k) => localStorage.removeItem(k));
  } catch {
    // ignore
  }
}
