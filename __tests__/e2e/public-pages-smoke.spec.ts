import { test, expect, Page } from '@playwright/test';

const BASE = process.env.PNL_TEST_E2E_BASE_URL ?? 'https://pepnationlab.com';

// Researcher test credentials
const RESEARCHER_EMAIL = 'pablo@internal.auth';
const RESEARCHER_PASS = 'PepTest123!!';

// -----------------------------------------------------------------------
// Helper: capture console errors
// -----------------------------------------------------------------------
function attachConsoleCapture(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  return errors;
}

// -----------------------------------------------------------------------
// PUBLIC PAGES
// -----------------------------------------------------------------------
test.describe('Public Pages Smoke Tests', () => {

  test('/about - renders about page', async ({ page }) => {
    const errors = attachConsoleCapture(page);
    await page.goto(`${BASE}/about`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    const snapshot = await page.title();
    const bodyText = await page.locator('body').innerText().catch(() => '');

    // Must NOT be blank or a redirect to login
    const url = page.url();
    expect(url).toContain('/about');

    // Should have meaningful heading
    const h1 = page.locator('h1, h2').first();
    await expect(h1).toBeVisible({ timeout: 5000 });
    const headingText = await h1.innerText().catch(() => '');
    console.log(`[/about] heading: "${headingText}" | title: "${snapshot}" | consoleErrors: ${errors.length}`);

    expect(bodyText.length).toBeGreaterThan(100);
  });

  test('/terms - renders terms of service', async ({ page }) => {
    const errors = attachConsoleCapture(page);
    await page.goto(`${BASE}/terms`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    const url = page.url();
    expect(url).toContain('/terms');

    const h1 = page.locator('h1, h2').first();
    await expect(h1).toBeVisible({ timeout: 5000 });
    const headingText = await h1.innerText().catch(() => '');
    const bodyText = await page.locator('body').innerText().catch(() => '');
    console.log(`[/terms] heading: "${headingText}" | consoleErrors: ${errors.length}`);

    expect(bodyText.length).toBeGreaterThan(100);
  });

  test('/privacy - renders privacy policy', async ({ page }) => {
    const errors = attachConsoleCapture(page);
    await page.goto(`${BASE}/privacy`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    const url = page.url();
    expect(url).toContain('/privacy');

    const h1 = page.locator('h1, h2').first();
    await expect(h1).toBeVisible({ timeout: 5000 });
    const headingText = await h1.innerText().catch(() => '');
    const bodyText = await page.locator('body').innerText().catch(() => '');
    console.log(`[/privacy] heading: "${headingText}" | consoleErrors: ${errors.length}`);

    expect(bodyText.length).toBeGreaterThan(100);
  });

  test('/compliance - renders compliance page', async ({ page }) => {
    const errors = attachConsoleCapture(page);
    await page.goto(`${BASE}/compliance`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    const url = page.url();
    expect(url).toContain('/compliance');

    const h1 = page.locator('h1, h2').first();
    await expect(h1).toBeVisible({ timeout: 5000 });
    const headingText = await h1.innerText().catch(() => '');
    const bodyText = await page.locator('body').innerText().catch(() => '');
    console.log(`[/compliance] heading: "${headingText}" | consoleErrors: ${errors.length}`);

    expect(bodyText.length).toBeGreaterThan(100);
  });

  test('/become-agent - renders agent application form', async ({ page }) => {
    const errors = attachConsoleCapture(page);
    await page.goto(`${BASE}/become-agent`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    const url = page.url();
    expect(url).toContain('/become-agent');

    const h1 = page.locator('h1, h2').first();
    await expect(h1).toBeVisible({ timeout: 5000 });
    const headingText = await h1.innerText().catch(() => '');
    const bodyText = await page.locator('body').innerText().catch(() => '');
    console.log(`[/become-agent] heading: "${headingText}" | consoleErrors: ${errors.length}`);

    // Should have a form
    const hasForm = await page.locator('form').count();
    console.log(`[/become-agent] form count: ${hasForm}`);
    expect(bodyText.length).toBeGreaterThan(100);
  });

  test('/login - renders login form with inputs', async ({ page }) => {
    const errors = attachConsoleCapture(page);
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    const url = page.url();
    expect(url).toContain('/login');

    const h1 = page.locator('h1, h2').first();
    await expect(h1).toBeVisible({ timeout: 5000 });
    const headingText = await h1.innerText().catch(() => '');
    console.log(`[/login] heading: "${headingText}" | consoleErrors: ${errors.length}`);

    // Should have email + password inputs and a submit button
    await expect(page.locator('input[type="email"], input[name="email"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('input[type="password"]')).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible({ timeout: 5000 });
  });

  test('/forgot-password - renders forgot password form', async ({ page }) => {
    const errors = attachConsoleCapture(page);
    await page.goto(`${BASE}/forgot-password`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    const url = page.url();
    expect(url).toContain('/forgot-password');

    const h1 = page.locator('h1, h2').first();
    await expect(h1).toBeVisible({ timeout: 5000 });
    const headingText = await h1.innerText().catch(() => '');
    const bodyText = await page.locator('body').innerText().catch(() => '');
    console.log(`[/forgot-password] heading: "${headingText}" | consoleErrors: ${errors.length}`);

    await expect(page.locator('input[type="email"], input[name="email"]')).toBeVisible({ timeout: 5000 });
    expect(bodyText.length).toBeGreaterThan(50);
  });

  test('/status - page returns non-500', async ({ page }) => {
    const errors = attachConsoleCapture(page);
    const response = await page.goto(`${BASE}/status`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);

    const statusCode = response?.status() ?? 0;
    const bodyText = await page.locator('body').innerText().catch(() => '');
    const url = page.url();
    console.log(`[/status] HTTP ${statusCode} | url: ${url} | bodyLength: ${bodyText.length} | consoleErrors: ${errors.length}`);

    // Status page may or may not exist (404 or redirect is fine; 500 is a FAIL)
    expect(statusCode).not.toBe(500);
  });

});

// -----------------------------------------------------------------------
// RESEARCHER LOGIN + AUTHENTICATED PAGES
// -----------------------------------------------------------------------
test.describe('Researcher Authenticated Pages', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);

    // Dismiss disclaimer gate if present
    const disclaimerAccept = page.locator('button').filter({ hasText: /i understand|accept|agree/i }).first();
    if (await disclaimerAccept.isVisible({ timeout: 3000 }).catch(() => false)) {
      await disclaimerAccept.click();
      await page.waitForTimeout(500);
    }

    const emailInput = page.locator('input[type="email"], input[name="email"]').first();
    const passInput = page.locator('input[type="password"]').first();
    await emailInput.fill(RESEARCHER_EMAIL);
    await passInput.fill(RESEARCHER_PASS);
    await page.getByRole('button', { name: /sign in/i }).click();

    await page.waitForURL(url => !url.toString().includes('/login'), { timeout: 15_000 });
    console.log(`[beforeEach] Logged in, now at: ${page.url()}`);
  });

  test('/products - page loads for researcher', async ({ page }) => {
    const errors = attachConsoleCapture(page);
    await page.goto(`${BASE}/products`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    const url = page.url();
    const bodyText = await page.locator('body').innerText().catch(() => '');
    const headingText = await page.locator('h1, h2').first().innerText().catch(() => '');
    console.log(`[/products] url: ${url} | heading: "${headingText}" | bodyLength: ${bodyText.length} | consoleErrors: ${errors.length}`);

    expect(url).not.toContain('/login');
    expect(bodyText.length).toBeGreaterThan(50);
  });

  test('/orders - page loads for researcher', async ({ page }) => {
    const errors = attachConsoleCapture(page);
    await page.goto(`${BASE}/orders`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    const url = page.url();
    const bodyText = await page.locator('body').innerText().catch(() => '');
    const headingText = await page.locator('h1, h2').first().innerText().catch(() => '');
    console.log(`[/orders] url: ${url} | heading: "${headingText}" | bodyLength: ${bodyText.length} | consoleErrors: ${errors.length}`);

    expect(url).not.toContain('/login');
    expect(bodyText.length).toBeGreaterThan(50);
  });

  test('/account - page loads for researcher', async ({ page }) => {
    const errors = attachConsoleCapture(page);
    await page.goto(`${BASE}/account`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    const url = page.url();
    const bodyText = await page.locator('body').innerText().catch(() => '');
    const headingText = await page.locator('h1, h2').first().innerText().catch(() => '');
    console.log(`[/account] url: ${url} | heading: "${headingText}" | bodyLength: ${bodyText.length} | consoleErrors: ${errors.length}`);

    expect(url).not.toContain('/login');
    expect(bodyText.length).toBeGreaterThan(50);
  });

  test('/wallet - page loads for researcher', async ({ page }) => {
    const errors = attachConsoleCapture(page);
    const response = await page.goto(`${BASE}/wallet`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    const statusCode = response?.status() ?? 0;
    const url = page.url();
    const bodyText = await page.locator('body').innerText().catch(() => '');
    const headingText = await page.locator('h1, h2').first().innerText().catch(() => '');
    console.log(`[/wallet] HTTP ${statusCode} | url: ${url} | heading: "${headingText}" | bodyLength: ${bodyText.length} | consoleErrors: ${errors.length}`);

    expect(url).not.toContain('/login');
    expect(statusCode).not.toBe(500);
    expect(bodyText.length).toBeGreaterThan(50);
  });

  test('/lab-journal - page loads for researcher', async ({ page }) => {
    const errors = attachConsoleCapture(page);
    const response = await page.goto(`${BASE}/lab-journal`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    const statusCode = response?.status() ?? 0;
    const url = page.url();
    const bodyText = await page.locator('body').innerText().catch(() => '');
    const headingText = await page.locator('h1, h2').first().innerText().catch(() => '');
    console.log(`[/lab-journal] HTTP ${statusCode} | url: ${url} | heading: "${headingText}" | bodyLength: ${bodyText.length} | consoleErrors: ${errors.length}`);

    expect(url).not.toContain('/login');
    expect(statusCode).not.toBe(500);
  });

  test('/lab-tools - page loads for researcher', async ({ page }) => {
    const errors = attachConsoleCapture(page);
    const response = await page.goto(`${BASE}/lab-tools`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    const statusCode = response?.status() ?? 0;
    const url = page.url();
    const bodyText = await page.locator('body').innerText().catch(() => '');
    const headingText = await page.locator('h1, h2').first().innerText().catch(() => '');
    console.log(`[/lab-tools] HTTP ${statusCode} | url: ${url} | heading: "${headingText}" | bodyLength: ${bodyText.length} | consoleErrors: ${errors.length}`);

    expect(url).not.toContain('/login');
    expect(statusCode).not.toBe(500);
  });

  test('/research - research hub loads for researcher', async ({ page }) => {
    const errors = attachConsoleCapture(page);
    await page.goto(`${BASE}/research`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    const url = page.url();
    const bodyText = await page.locator('body').innerText().catch(() => '');
    const headingText = await page.locator('h1, h2').first().innerText().catch(() => '');
    console.log(`[/research] url: ${url} | heading: "${headingText}" | bodyLength: ${bodyText.length} | consoleErrors: ${errors.length}`);

    expect(url).not.toContain('/login');
    expect(bodyText.length).toBeGreaterThan(50);
  });

  test('/research/catalog - compound catalog loads', async ({ page }) => {
    const errors = attachConsoleCapture(page);
    await page.goto(`${BASE}/research/catalog`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    const url = page.url();
    const bodyText = await page.locator('body').innerText().catch(() => '');
    const headingText = await page.locator('h1, h2').first().innerText().catch(() => '');
    console.log(`[/research/catalog] url: ${url} | heading: "${headingText}" | bodyLength: ${bodyText.length} | consoleErrors: ${errors.length}`);

    expect(url).not.toContain('/login');
    expect(bodyText.length).toBeGreaterThan(100);
  });

  test('/research/bpc-157 - compound detail page loads', async ({ page }) => {
    const errors = attachConsoleCapture(page);
    const response = await page.goto(`${BASE}/research/bpc-157`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);

    const statusCode = response?.status() ?? 0;
    const url = page.url();
    const bodyText = await page.locator('body').innerText().catch(() => '');
    const headingText = await page.locator('h1, h2').first().innerText().catch(() => '');
    console.log(`[/research/bpc-157] HTTP ${statusCode} | url: ${url} | heading: "${headingText}" | bodyLength: ${bodyText.length} | consoleErrors: ${errors.length}`);

    expect(url).not.toContain('/login');
    expect(statusCode).not.toBe(500);
    expect(bodyText.length).toBeGreaterThan(100);
  });

});
