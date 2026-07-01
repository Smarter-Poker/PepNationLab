/**
 * Full Page Audit — 50 pages across public, researcher-authenticated,
 * and research library routes.
 *
 * Run against production:
 *   PNL_TEST_E2E_BASE_URL=https://pepnationlab.com npx playwright test __tests__/e2e/full-page-audit.spec.ts --reporter=list
 */

import { test, expect, Page } from '@playwright/test';

const BASE = process.env.PNL_TEST_E2E_BASE_URL ?? 'https://pepnationlab.com';
const RESEARCHER_EMAIL = 'pablo@internal.auth';
const RESEARCHER_PASS = 'PepTest123!!';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function attachConsoleCapture(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  return errors;
}

async function pageStatus(page: Page, url: string): Promise<{
  httpStatus: number;
  finalUrl: string;
  heading: string;
  bodyLen: number;
  consoleErrors: string[];
}> {
  const errors = attachConsoleCapture(page);
  const response = await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2000);

  const httpStatus = response?.status() ?? 0;
  const finalUrl = page.url();
  const heading = await page.locator('h1, h2').first().innerText().catch(() => '');
  const bodyLen = (await page.locator('body').innerText().catch(() => '')).length;

  return { httpStatus, finalUrl, heading, bodyLen, consoleErrors: errors };
}

// ---------------------------------------------------------------------------
// Helper: login as researcher (re-usable in beforeEach)
// ---------------------------------------------------------------------------
async function loginAsResearcher(page: Page): Promise<void> {
  await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);

  // Dismiss disclaimer gate if it overlays the page
  const disclaimerBtn = page.locator('button').filter({ hasText: /i understand|accept|agree/i }).first();
  if (await disclaimerBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await disclaimerBtn.click();
    await page.waitForTimeout(500);
  }

  const emailInput = page.locator('input[type="email"], input[name="email"]').first();
  const passInput = page.locator('input[type="password"]').first();
  await emailInput.fill(RESEARCHER_EMAIL);
  await passInput.fill(RESEARCHER_PASS);
  await page.getByRole('button', { name: /sign in/i }).click();

  await page.waitForURL(u => !u.toString().includes('/login'), { timeout: 20_000 });
}

// ===========================================================================
// SECTION 1 -- PUBLIC PAGES (no login needed)
// ===========================================================================
test.describe('Section 1: Public Pages', () => {

  test('1 /about', async ({ page }) => {
    const s = await pageStatus(page, `${BASE}/about`);
    console.log(`1 | /about | HTTP ${s.httpStatus} | url: ${s.finalUrl} | heading: "${s.heading}" | body: ${s.bodyLen} | errors: ${s.consoleErrors.length}`);
    expect(s.finalUrl).toContain('/about');
    expect(s.httpStatus).not.toBe(500);
    expect(s.bodyLen).toBeGreaterThan(100);
  });

  test('2 /terms', async ({ page }) => {
    const s = await pageStatus(page, `${BASE}/terms`);
    console.log(`2 | /terms | HTTP ${s.httpStatus} | url: ${s.finalUrl} | heading: "${s.heading}" | body: ${s.bodyLen} | errors: ${s.consoleErrors.length}`);
    expect(s.finalUrl).toContain('/terms');
    expect(s.httpStatus).not.toBe(500);
    expect(s.bodyLen).toBeGreaterThan(100);
  });

  test('3 /privacy', async ({ page }) => {
    const s = await pageStatus(page, `${BASE}/privacy`);
    console.log(`3 | /privacy | HTTP ${s.httpStatus} | url: ${s.finalUrl} | heading: "${s.heading}" | body: ${s.bodyLen} | errors: ${s.consoleErrors.length}`);
    expect(s.finalUrl).toContain('/privacy');
    expect(s.httpStatus).not.toBe(500);
    expect(s.bodyLen).toBeGreaterThan(100);
  });

  test('4 /compliance', async ({ page }) => {
    const s = await pageStatus(page, `${BASE}/compliance`);
    console.log(`4 | /compliance | HTTP ${s.httpStatus} | url: ${s.finalUrl} | heading: "${s.heading}" | body: ${s.bodyLen} | errors: ${s.consoleErrors.length}`);
    expect(s.finalUrl).toContain('/compliance');
    expect(s.httpStatus).not.toBe(500);
    expect(s.bodyLen).toBeGreaterThan(100);
  });

  test('5 /become-agent', async ({ page }) => {
    const s = await pageStatus(page, `${BASE}/become-agent`);
    console.log(`5 | /become-agent | HTTP ${s.httpStatus} | url: ${s.finalUrl} | heading: "${s.heading}" | body: ${s.bodyLen} | errors: ${s.consoleErrors.length}`);
    expect(s.finalUrl).toContain('/become-agent');
    expect(s.httpStatus).not.toBe(500);
    expect(s.bodyLen).toBeGreaterThan(100);
  });

  test('6 /login', async ({ page }) => {
    const s = await pageStatus(page, `${BASE}/login`);
    console.log(`6 | /login | HTTP ${s.httpStatus} | url: ${s.finalUrl} | heading: "${s.heading}" | body: ${s.bodyLen} | errors: ${s.consoleErrors.length}`);
    expect(s.finalUrl).toContain('/login');
    expect(s.httpStatus).not.toBe(500);
    await expect(page.locator('input[type="email"], input[name="email"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('input[type="password"]')).toBeVisible({ timeout: 5000 });
  });

  test('7 /forgot-password', async ({ page }) => {
    const s = await pageStatus(page, `${BASE}/forgot-password`);
    console.log(`7 | /forgot-password | HTTP ${s.httpStatus} | url: ${s.finalUrl} | heading: "${s.heading}" | body: ${s.bodyLen} | errors: ${s.consoleErrors.length}`);
    expect(s.finalUrl).toContain('/forgot-password');
    expect(s.httpStatus).not.toBe(500);
    expect(s.bodyLen).toBeGreaterThan(50);
  });

  test('8 /disclaimer', async ({ page }) => {
    const s = await pageStatus(page, `${BASE}/disclaimer`);
    console.log(`8 | /disclaimer | HTTP ${s.httpStatus} | url: ${s.finalUrl} | heading: "${s.heading}" | body: ${s.bodyLen} | errors: ${s.consoleErrors.length}`);
    expect(s.httpStatus).not.toBe(500);
  });

  test('9 /status', async ({ page }) => {
    const s = await pageStatus(page, `${BASE}/status`);
    console.log(`9 | /status | HTTP ${s.httpStatus} | url: ${s.finalUrl} | heading: "${s.heading}" | body: ${s.bodyLen} | errors: ${s.consoleErrors.length}`);
    expect(s.httpStatus).not.toBe(500);
  });

  test('10 /scooters (agent storefront)', async ({ page }) => {
    const s = await pageStatus(page, `${BASE}/scooters`);
    console.log(`10 | /scooters | HTTP ${s.httpStatus} | url: ${s.finalUrl} | heading: "${s.heading}" | body: ${s.bodyLen} | errors: ${s.consoleErrors.length}`);
    expect(s.httpStatus).not.toBe(500);
    expect(s.bodyLen).toBeGreaterThan(50);
  });

});

// ===========================================================================
// SECTION 2 -- RESEARCHER AUTHENTICATED PAGES
// ===========================================================================
test.describe('Section 2: Researcher Authenticated Pages', () => {

  test.beforeEach(async ({ page }) => {
    await loginAsResearcher(page);
  });

  test('11 /account', async ({ page }) => {
    const s = await pageStatus(page, `${BASE}/account`);
    console.log(`11 | /account | HTTP ${s.httpStatus} | url: ${s.finalUrl} | heading: "${s.heading}" | body: ${s.bodyLen} | errors: ${s.consoleErrors.length}`);
    expect(s.finalUrl).not.toContain('/login');
    expect(s.httpStatus).not.toBe(500);
    expect(s.bodyLen).toBeGreaterThan(50);
  });

  test('12 /account/referrals (NEW)', async ({ page }) => {
    const s = await pageStatus(page, `${BASE}/account/referrals`);
    console.log(`12 | /account/referrals | HTTP ${s.httpStatus} | url: ${s.finalUrl} | heading: "${s.heading}" | body: ${s.bodyLen} | errors: ${s.consoleErrors.length}`);
    expect(s.finalUrl).not.toContain('/login');
    expect(s.httpStatus).not.toBe(500);
    expect(s.httpStatus).not.toBe(404);
    expect(s.bodyLen).toBeGreaterThan(50);
  });

  test('13 /account/change-password', async ({ page }) => {
    const s = await pageStatus(page, `${BASE}/account/change-password`);
    console.log(`13 | /account/change-password | HTTP ${s.httpStatus} | url: ${s.finalUrl} | heading: "${s.heading}" | body: ${s.bodyLen} | errors: ${s.consoleErrors.length}`);
    expect(s.finalUrl).not.toContain('/login');
    expect(s.httpStatus).not.toBe(500);
  });

  test('14 /account/profile', async ({ page }) => {
    const s = await pageStatus(page, `${BASE}/account/profile`);
    console.log(`14 | /account/profile | HTTP ${s.httpStatus} | url: ${s.finalUrl} | heading: "${s.heading}" | body: ${s.bodyLen} | errors: ${s.consoleErrors.length}`);
    expect(s.finalUrl).not.toContain('/login');
    expect(s.httpStatus).not.toBe(500);
  });

  test('15 /account/security', async ({ page }) => {
    const s = await pageStatus(page, `${BASE}/account/security`);
    console.log(`15 | /account/security | HTTP ${s.httpStatus} | url: ${s.finalUrl} | heading: "${s.heading}" | body: ${s.bodyLen} | errors: ${s.consoleErrors.length}`);
    expect(s.finalUrl).not.toContain('/login');
    expect(s.httpStatus).not.toBe(500);
  });

  test('16 /account/notifications', async ({ page }) => {
    const s = await pageStatus(page, `${BASE}/account/notifications`);
    console.log(`16 | /account/notifications | HTTP ${s.httpStatus} | url: ${s.finalUrl} | heading: "${s.heading}" | body: ${s.bodyLen} | errors: ${s.consoleErrors.length}`);
    expect(s.finalUrl).not.toContain('/login');
    expect(s.httpStatus).not.toBe(500);
  });

  test('17 /account/addresses', async ({ page }) => {
    const s = await pageStatus(page, `${BASE}/account/addresses`);
    console.log(`17 | /account/addresses | HTTP ${s.httpStatus} | url: ${s.finalUrl} | heading: "${s.heading}" | body: ${s.bodyLen} | errors: ${s.consoleErrors.length}`);
    expect(s.finalUrl).not.toContain('/login');
    expect(s.httpStatus).not.toBe(500);
  });

  test('18 /account/compliance', async ({ page }) => {
    const s = await pageStatus(page, `${BASE}/account/compliance`);
    console.log(`18 | /account/compliance | HTTP ${s.httpStatus} | url: ${s.finalUrl} | heading: "${s.heading}" | body: ${s.bodyLen} | errors: ${s.consoleErrors.length}`);
    expect(s.finalUrl).not.toContain('/login');
    expect(s.httpStatus).not.toBe(500);
  });

  test('19 /account/help', async ({ page }) => {
    const s = await pageStatus(page, `${BASE}/account/help`);
    console.log(`19 | /account/help | HTTP ${s.httpStatus} | url: ${s.finalUrl} | heading: "${s.heading}" | body: ${s.bodyLen} | errors: ${s.consoleErrors.length}`);
    expect(s.finalUrl).not.toContain('/login');
    expect(s.httpStatus).not.toBe(500);
  });

  test('20 /account/refills', async ({ page }) => {
    const s = await pageStatus(page, `${BASE}/account/refills`);
    console.log(`20 | /account/refills | HTTP ${s.httpStatus} | url: ${s.finalUrl} | heading: "${s.heading}" | body: ${s.bodyLen} | errors: ${s.consoleErrors.length}`);
    expect(s.finalUrl).not.toContain('/login');
    expect(s.httpStatus).not.toBe(500);
  });

  test('21 /wallet', async ({ page }) => {
    const s = await pageStatus(page, `${BASE}/wallet`);
    console.log(`21 | /wallet | HTTP ${s.httpStatus} | url: ${s.finalUrl} | heading: "${s.heading}" | body: ${s.bodyLen} | errors: ${s.consoleErrors.length}`);
    expect(s.finalUrl).not.toContain('/login');
    expect(s.httpStatus).not.toBe(500);
    expect(s.bodyLen).toBeGreaterThan(50);
  });

  test('22 /lab-journal', async ({ page }) => {
    const s = await pageStatus(page, `${BASE}/lab-journal`);
    console.log(`22 | /lab-journal | HTTP ${s.httpStatus} | url: ${s.finalUrl} | heading: "${s.heading}" | body: ${s.bodyLen} | errors: ${s.consoleErrors.length}`);
    expect(s.finalUrl).not.toContain('/login');
    expect(s.httpStatus).not.toBe(500);
  });

  test('23 /shelf-life', async ({ page }) => {
    const s = await pageStatus(page, `${BASE}/shelf-life`);
    console.log(`23 | /shelf-life | HTTP ${s.httpStatus} | url: ${s.finalUrl} | heading: "${s.heading}" | body: ${s.bodyLen} | errors: ${s.consoleErrors.length}`);
    expect(s.finalUrl).not.toContain('/login');
    expect(s.httpStatus).not.toBe(500);
  });

  test('24 /peptide-101', async ({ page }) => {
    const s = await pageStatus(page, `${BASE}/peptide-101`);
    console.log(`24 | /peptide-101 | HTTP ${s.httpStatus} | url: ${s.finalUrl} | heading: "${s.heading}" | body: ${s.bodyLen} | errors: ${s.consoleErrors.length}`);
    expect(s.finalUrl).not.toContain('/login');
    expect(s.httpStatus).not.toBe(500);
  });

  test('25 /find-a-peptide', async ({ page }) => {
    const s = await pageStatus(page, `${BASE}/find-a-peptide`);
    console.log(`25 | /find-a-peptide | HTTP ${s.httpStatus} | url: ${s.finalUrl} | heading: "${s.heading}" | body: ${s.bodyLen} | errors: ${s.consoleErrors.length}`);
    expect(s.finalUrl).not.toContain('/login');
    expect(s.httpStatus).not.toBe(500);
  });

  test('26 /messenger', async ({ page }) => {
    const s = await pageStatus(page, `${BASE}/messenger`);
    console.log(`26 | /messenger | HTTP ${s.httpStatus} | url: ${s.finalUrl} | heading: "${s.heading}" | body: ${s.bodyLen} | errors: ${s.consoleErrors.length}`);
    expect(s.finalUrl).not.toContain('/login');
    expect(s.httpStatus).not.toBe(500);
    expect(s.bodyLen).toBeGreaterThan(50);
  });

  test('27 /orders', async ({ page }) => {
    const s = await pageStatus(page, `${BASE}/orders`);
    console.log(`27 | /orders | HTTP ${s.httpStatus} | url: ${s.finalUrl} | heading: "${s.heading}" | body: ${s.bodyLen} | errors: ${s.consoleErrors.length}`);
    expect(s.finalUrl).not.toContain('/login');
    expect(s.httpStatus).not.toBe(500);
    expect(s.bodyLen).toBeGreaterThan(50);
  });

  test('28 /products (redirect to /research/catalog)', async ({ page }) => {
    const s = await pageStatus(page, `${BASE}/products`);
    console.log(`28 | /products | HTTP ${s.httpStatus} | url: ${s.finalUrl} | heading: "${s.heading}" | body: ${s.bodyLen} | errors: ${s.consoleErrors.length}`);
    expect(s.finalUrl).not.toContain('/login');
    expect(s.httpStatus).not.toBe(500);
    expect(s.bodyLen).toBeGreaterThan(50);
  });

});

// ===========================================================================
// SECTION 3 -- RESEARCH LIBRARY PAGES (authenticated)
// ===========================================================================
test.describe('Section 3: Research Library Pages', () => {

  test.beforeEach(async ({ page }) => {
    await loginAsResearcher(page);
  });

  test('29 /research', async ({ page }) => {
    const s = await pageStatus(page, `${BASE}/research`);
    console.log(`29 | /research | HTTP ${s.httpStatus} | url: ${s.finalUrl} | heading: "${s.heading}" | body: ${s.bodyLen} | errors: ${s.consoleErrors.length}`);
    expect(s.finalUrl).not.toContain('/login');
    expect(s.httpStatus).not.toBe(500);
    expect(s.bodyLen).toBeGreaterThan(100);
  });

  test('30 /research/catalog', async ({ page }) => {
    const s = await pageStatus(page, `${BASE}/research/catalog`);
    console.log(`30 | /research/catalog | HTTP ${s.httpStatus} | url: ${s.finalUrl} | heading: "${s.heading}" | body: ${s.bodyLen} | errors: ${s.consoleErrors.length}`);
    expect(s.finalUrl).not.toContain('/login');
    expect(s.httpStatus).not.toBe(500);
    expect(s.bodyLen).toBeGreaterThan(100);
  });

  test('31 /research/bpc-157', async ({ page }) => {
    const s = await pageStatus(page, `${BASE}/research/bpc-157`);
    console.log(`31 | /research/bpc-157 | HTTP ${s.httpStatus} | url: ${s.finalUrl} | heading: "${s.heading}" | body: ${s.bodyLen} | errors: ${s.consoleErrors.length}`);
    expect(s.finalUrl).not.toContain('/login');
    expect(s.httpStatus).not.toBe(500);
    expect(s.bodyLen).toBeGreaterThan(100);
  });

  test('32 /research/tb-500', async ({ page }) => {
    const s = await pageStatus(page, `${BASE}/research/tb-500`);
    console.log(`32 | /research/tb-500 | HTTP ${s.httpStatus} | url: ${s.finalUrl} | heading: "${s.heading}" | body: ${s.bodyLen} | errors: ${s.consoleErrors.length}`);
    expect(s.finalUrl).not.toContain('/login');
    expect(s.httpStatus).not.toBe(500);
    expect(s.bodyLen).toBeGreaterThan(100);
  });

  test('33 /research/search', async ({ page }) => {
    const s = await pageStatus(page, `${BASE}/research/search`);
    console.log(`33 | /research/search | HTTP ${s.httpStatus} | url: ${s.finalUrl} | heading: "${s.heading}" | body: ${s.bodyLen} | errors: ${s.consoleErrors.length}`);
    expect(s.finalUrl).not.toContain('/login');
    expect(s.httpStatus).not.toBe(500);
  });

  test('34 /research/glossary', async ({ page }) => {
    const s = await pageStatus(page, `${BASE}/research/glossary`);
    console.log(`34 | /research/glossary | HTTP ${s.httpStatus} | url: ${s.finalUrl} | heading: "${s.heading}" | body: ${s.bodyLen} | errors: ${s.consoleErrors.length}`);
    expect(s.finalUrl).not.toContain('/login');
    expect(s.httpStatus).not.toBe(500);
  });

  test('35 /research/calculators', async ({ page }) => {
    const s = await pageStatus(page, `${BASE}/research/calculators`);
    console.log(`35 | /research/calculators | HTTP ${s.httpStatus} | url: ${s.finalUrl} | heading: "${s.heading}" | body: ${s.bodyLen} | errors: ${s.consoleErrors.length}`);
    expect(s.finalUrl).not.toContain('/login');
    expect(s.httpStatus).not.toBe(500);
  });

  test('36 /research/saved', async ({ page }) => {
    const s = await pageStatus(page, `${BASE}/research/saved`);
    console.log(`36 | /research/saved | HTTP ${s.httpStatus} | url: ${s.finalUrl} | heading: "${s.heading}" | body: ${s.bodyLen} | errors: ${s.consoleErrors.length}`);
    expect(s.finalUrl).not.toContain('/login');
    expect(s.httpStatus).not.toBe(500);
  });

  test('37 /research/reading-queue', async ({ page }) => {
    const s = await pageStatus(page, `${BASE}/research/reading-queue`);
    console.log(`37 | /research/reading-queue | HTTP ${s.httpStatus} | url: ${s.finalUrl} | heading: "${s.heading}" | body: ${s.bodyLen} | errors: ${s.consoleErrors.length}`);
    expect(s.finalUrl).not.toContain('/login');
    expect(s.httpStatus).not.toBe(500);
  });

  test('38 /research/subscriptions', async ({ page }) => {
    const s = await pageStatus(page, `${BASE}/research/subscriptions`);
    console.log(`38 | /research/subscriptions | HTTP ${s.httpStatus} | url: ${s.finalUrl} | heading: "${s.heading}" | body: ${s.bodyLen} | errors: ${s.consoleErrors.length}`);
    expect(s.finalUrl).not.toContain('/login');
    expect(s.httpStatus).not.toBe(500);
  });

  test('39 /research/stacks', async ({ page }) => {
    const s = await pageStatus(page, `${BASE}/research/stacks`);
    console.log(`39 | /research/stacks | HTTP ${s.httpStatus} | url: ${s.finalUrl} | heading: "${s.heading}" | body: ${s.bodyLen} | errors: ${s.consoleErrors.length}`);
    expect(s.finalUrl).not.toContain('/login');
    expect(s.httpStatus).not.toBe(500);
  });

  test('40 /research/compare', async ({ page }) => {
    const s = await pageStatus(page, `${BASE}/research/compare`);
    console.log(`40 | /research/compare | HTTP ${s.httpStatus} | url: ${s.finalUrl} | heading: "${s.heading}" | body: ${s.bodyLen} | errors: ${s.consoleErrors.length}`);
    expect(s.finalUrl).not.toContain('/login');
    expect(s.httpStatus).not.toBe(500);
  });

  test('41 /research/a-z', async ({ page }) => {
    const s = await pageStatus(page, `${BASE}/research/a-z`);
    console.log(`41 | /research/a-z | HTTP ${s.httpStatus} | url: ${s.finalUrl} | heading: "${s.heading}" | body: ${s.bodyLen} | errors: ${s.consoleErrors.length}`);
    expect(s.finalUrl).not.toContain('/login');
    expect(s.httpStatus).not.toBe(500);
  });

  test('42 /research/by-class', async ({ page }) => {
    const s = await pageStatus(page, `${BASE}/research/by-class`);
    console.log(`42 | /research/by-class | HTTP ${s.httpStatus} | url: ${s.finalUrl} | heading: "${s.heading}" | body: ${s.bodyLen} | errors: ${s.consoleErrors.length}`);
    expect(s.finalUrl).not.toContain('/login');
    expect(s.httpStatus).not.toBe(500);
  });

  test('43 /research/by-half-life', async ({ page }) => {
    const s = await pageStatus(page, `${BASE}/research/by-half-life`);
    console.log(`43 | /research/by-half-life | HTTP ${s.httpStatus} | url: ${s.finalUrl} | heading: "${s.heading}" | body: ${s.bodyLen} | errors: ${s.consoleErrors.length}`);
    expect(s.finalUrl).not.toContain('/login');
    expect(s.httpStatus).not.toBe(500);
  });

  test('44 /research/by-mechanism', async ({ page }) => {
    const s = await pageStatus(page, `${BASE}/research/by-mechanism`);
    console.log(`44 | /research/by-mechanism | HTTP ${s.httpStatus} | url: ${s.finalUrl} | heading: "${s.heading}" | body: ${s.bodyLen} | errors: ${s.consoleErrors.length}`);
    expect(s.finalUrl).not.toContain('/login');
    expect(s.httpStatus).not.toBe(500);
  });

  test('45 /research/by-route', async ({ page }) => {
    const s = await pageStatus(page, `${BASE}/research/by-route`);
    console.log(`45 | /research/by-route | HTTP ${s.httpStatus} | url: ${s.finalUrl} | heading: "${s.heading}" | body: ${s.bodyLen} | errors: ${s.consoleErrors.length}`);
    expect(s.finalUrl).not.toContain('/login');
    expect(s.httpStatus).not.toBe(500);
  });

  test('46 /research/by-target', async ({ page }) => {
    const s = await pageStatus(page, `${BASE}/research/by-target`);
    console.log(`46 | /research/by-target | HTTP ${s.httpStatus} | url: ${s.finalUrl} | heading: "${s.heading}" | body: ${s.bodyLen} | errors: ${s.consoleErrors.length}`);
    expect(s.finalUrl).not.toContain('/login');
    expect(s.httpStatus).not.toBe(500);
  });

  test('47 /research/by-mw', async ({ page }) => {
    const s = await pageStatus(page, `${BASE}/research/by-mw`);
    console.log(`47 | /research/by-mw | HTTP ${s.httpStatus} | url: ${s.finalUrl} | heading: "${s.heading}" | body: ${s.bodyLen} | errors: ${s.consoleErrors.length}`);
    expect(s.finalUrl).not.toContain('/login');
    expect(s.httpStatus).not.toBe(500);
  });

  test('48 /research/areas', async ({ page }) => {
    const s = await pageStatus(page, `${BASE}/research/areas`);
    console.log(`48 | /research/areas | HTTP ${s.httpStatus} | url: ${s.finalUrl} | heading: "${s.heading}" | body: ${s.bodyLen} | errors: ${s.consoleErrors.length}`);
    expect(s.finalUrl).not.toContain('/login');
    expect(s.httpStatus).not.toBe(500);
  });

  test('49 /research/timeline', async ({ page }) => {
    const s = await pageStatus(page, `${BASE}/research/timeline`);
    console.log(`49 | /research/timeline | HTTP ${s.httpStatus} | url: ${s.finalUrl} | heading: "${s.heading}" | body: ${s.bodyLen} | errors: ${s.consoleErrors.length}`);
    expect(s.finalUrl).not.toContain('/login');
    expect(s.httpStatus).not.toBe(500);
  });

  test('50 /research/faq', async ({ page }) => {
    const s = await pageStatus(page, `${BASE}/research/faq`);
    console.log(`50 | /research/faq | HTTP ${s.httpStatus} | url: ${s.finalUrl} | heading: "${s.heading}" | body: ${s.bodyLen} | errors: ${s.consoleErrors.length}`);
    expect(s.finalUrl).not.toContain('/login');
    expect(s.httpStatus).not.toBe(500);
  });

});
