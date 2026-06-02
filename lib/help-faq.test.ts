/**
 * R28 — Guardrail tests for the FAQ catalog.
 *
 * Cheap drift catches that run with `npx vitest run lib/help-faq.test.ts`.
 * Asserts platform invariants the client and the help page assume:
 *
 *   - Every category in FAQ_CATEGORIES has at least one item
 *   - Every item id is unique kebab-case
 *   - Every item's category matches a real FAQ_CATEGORIES id
 *   - Every internal href in links[] starts with '/'
 *   - No question or answer exceeds 800 characters
 *   - audience='admin' items live only in admin-audience categories
 *   - Role gating: researcher / agent / admin visibility filters work
 *   - searchFaq and suggestFaq return sensible results
 */

import { describe, it, expect } from 'vitest';
import {
  FAQ_CATEGORIES,
  FAQ_ITEMS,
  suggestFaq,
  searchFaq,
  visibleFaq,
  visibleCategories,
  faqDeepLink,
} from './help-faq';

const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const ALLOWED_INTERNAL_ROUTES = new Set([
  '/account',
  '/account/addresses',
  '/account/payment-method',
  '/account/wishlist',
  '/account/recently-viewed',
  '/account/referrals',
  '/account/help',
  '/orders',
  '/messenger',
  '/wallet',
  '/forgot-password',
  '/become-agent',
  '/dashboard/agent/help',
]);
const ALLOWED_QUERY_TABS = new Set([
  '/account?tab=compliance',
  '/account?tab=security',
  '/account?tab=notifications',
]);

describe('FAQ catalog — structural invariants', () => {
  it('every category has at least one item', () => {
    const categoriesWithItems = new Set(FAQ_ITEMS.map((it) => it.category));
    for (const cat of FAQ_CATEGORIES) {
      expect(
        categoriesWithItems.has(cat.id),
        `Category "${cat.id}" has zero items in FAQ_ITEMS`,
      ).toBe(true);
    }
  });

  it('every item id is unique and kebab-case', () => {
    const seen = new Set<string>();
    for (const it of FAQ_ITEMS) {
      expect(KEBAB.test(it.id), `id "${it.id}" is not kebab-case`).toBe(true);
      expect(seen.has(it.id), `duplicate id "${it.id}"`).toBe(false);
      seen.add(it.id);
    }
  });

  it("every item's category matches a FAQ_CATEGORIES id", () => {
    const validIds = new Set(FAQ_CATEGORIES.map((c) => c.id));
    for (const it of FAQ_ITEMS) {
      expect(
        validIds.has(it.category),
        `Item "${it.id}" references unknown category "${it.category}"`,
      ).toBe(true);
    }
  });

  it('every link href points at a known internal route', () => {
    for (const it of FAQ_ITEMS) {
      for (const link of it.links ?? []) {
        expect(
          link.href.startsWith('/'),
          `Item "${it.id}" link "${link.label}" is not internal (${link.href})`,
        ).toBe(true);
        const known =
          ALLOWED_INTERNAL_ROUTES.has(link.href) ||
          ALLOWED_QUERY_TABS.has(link.href);
        expect(
          known,
          `Item "${it.id}" link href "${link.href}" is not on the allow-list — add it to ALLOWED_INTERNAL_ROUTES / ALLOWED_QUERY_TABS or fix the route`,
        ).toBe(true);
      }
    }
  });

  it('no question or answer exceeds 800 characters', () => {
    for (const it of FAQ_ITEMS) {
      expect(it.q.length, `Question "${it.id}" is too long`).toBeLessThanOrEqual(
        800,
      );
      expect(it.a.length, `Answer "${it.id}" is too long`).toBeLessThanOrEqual(
        800,
      );
    }
  });

  it('admin items only live in admin-audience categories', () => {
    const adminCategoryIds = new Set(
      FAQ_CATEGORIES.filter((c) => c.audience === 'admin').map((c) => c.id),
    );
    for (const it of FAQ_ITEMS) {
      if (it.audience === 'admin') {
        expect(
          adminCategoryIds.has(it.category),
          `Admin item "${it.id}" lives in non-admin category "${it.category}"`,
        ).toBe(true);
      }
    }
  });

  it('faqDeepLink returns the expected hash anchor', () => {
    expect(faqDeepLink('how-do-i-sign-up')).toBe(
      '/account/help#faq-how-do-i-sign-up',
    );
  });
});

describe('Role gating', () => {
  it('researchers do not see agent-only or admin-only items', () => {
    const visible = visibleFaq('researcher');
    for (const it of visible) {
      expect(it.audience).not.toBe('agent');
      expect(it.audience).not.toBe('admin');
    }
  });

  it('agents see agent items but not admin-only items', () => {
    const visible = visibleFaq('agent');
    const hasAgent = visible.some((it) => it.audience === 'agent');
    const hasAdmin = visible.some((it) => it.audience === 'admin');
    expect(hasAgent).toBe(true);
    expect(hasAdmin).toBe(false);
  });

  it('admins see every item including admin-only', () => {
    const visible = visibleFaq('admin');
    expect(visible.length).toBe(FAQ_ITEMS.length);
  });

  it('researchers do not see admin categories', () => {
    const cats = visibleCategories('researcher');
    for (const c of cats) {
      expect(c.audience).not.toBe('admin');
      expect(c.audience).not.toBe('agent');
    }
  });
});

describe('Search and suggestion helpers', () => {
  it('searchFaq returns matches for a known token', () => {
    const hits = searchFaq('zelle', FAQ_ITEMS);
    expect(hits.size).toBeGreaterThan(0);
    expect(hits.has('zelle-tips')).toBe(true);
  });

  it('searchFaq returns every item for empty query', () => {
    const hits = searchFaq('', FAQ_ITEMS);
    expect(hits.size).toBe(FAQ_ITEMS.length);
  });

  it('suggestFaq returns top hits for natural-language prompts', () => {
    const out = suggestFaq(
      'my order is stuck in approval pending what do i do',
      FAQ_ITEMS,
      3,
    );
    expect(out.length).toBeGreaterThan(0);
    const ids = out.map((h) => h.item.id);
    expect(
      ids.includes('order-stuck-in-approval') ||
        ids.includes('order-statuses-explained'),
    ).toBe(true);
  });

  it('suggestFaq returns empty for very short or empty prompts', () => {
    expect(suggestFaq('', FAQ_ITEMS, 3)).toEqual([]);
    expect(suggestFaq('a', FAQ_ITEMS, 3)).toEqual([]);
  });

  it('suggestFaq scores are bounded between 0 and 100', () => {
    const out = suggestFaq('payment method credit card refund', FAQ_ITEMS, 5);
    for (const hit of out) {
      expect(hit.score).toBeGreaterThan(0);
      expect(hit.score).toBeLessThanOrEqual(100);
    }
  });
});
