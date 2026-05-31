/**
 * audit15 fix-27 (B10): two-browser E2E call test.
 *
 * Run with:
 *   PNL_TEST_E2E_USER_A_EMAIL=...
 *   PNL_TEST_E2E_USER_A_PASSWORD=...
 *   PNL_TEST_E2E_USER_B_EMAIL=...
 *   PNL_TEST_E2E_USER_B_PASSWORD=...
 *   npx playwright test __tests__/e2e/messenger-call.spec.ts
 *
 * The test instantiates two independent browser contexts, logs each into
 * a distinct account, opens a shared messenger conversation, and exercises
 * the ring → accept → hangup state machine. Asserts the visible UI flows
 * cleanly between states.
 *
 * Skipped automatically when env vars are missing (don't fail CI for users
 * who haven't provisioned test accounts yet).
 */

import { test, expect } from '@playwright/test';

const BASE = process.env.PNL_TEST_E2E_BASE_URL ?? 'http://localhost:3000';
const USER_A_EMAIL = process.env.PNL_TEST_E2E_USER_A_EMAIL ?? '';
const USER_A_PASS = process.env.PNL_TEST_E2E_USER_A_PASSWORD ?? '';
const USER_B_EMAIL = process.env.PNL_TEST_E2E_USER_B_EMAIL ?? '';
const USER_B_PASS = process.env.PNL_TEST_E2E_USER_B_PASSWORD ?? '';

const SKIP_REASON = (() => {
  if (!USER_A_EMAIL || !USER_A_PASS) return 'PNL_TEST_E2E_USER_A_* unset';
  if (!USER_B_EMAIL || !USER_B_PASS) return 'PNL_TEST_E2E_USER_B_* unset';
  return null;
})();

test.describe('Messenger call flow', () => {
  test.skip(!!SKIP_REASON, SKIP_REASON ?? '');

  test('caller can ring, answerer accepts, both can hang up', async ({ browser }) => {
    test.setTimeout(60_000);

    // --- Two independent contexts (one per user) ---
    const ctxA = await browser.newContext();
    const ctxB = await browser.newContext();
    const pageA = await ctxA.newPage();
    const pageB = await ctxB.newPage();

    // --- Sign both users in ---
    async function signIn(page: typeof pageA, email: string, pass: string) {
      await page.goto(`${BASE}/login`);
      await page.getByLabel(/email/i).fill(email);
      await page.getByLabel(/password/i).fill(pass);
      await page.getByRole('button', { name: /sign in/i }).click();
      await page.waitForURL((u) => !u.toString().endsWith('/login'), { timeout: 15_000 });
    }
    await Promise.all([
      signIn(pageA, USER_A_EMAIL, USER_A_PASS),
      signIn(pageB, USER_B_EMAIL, USER_B_PASS),
    ]);

    // --- Both navigate to the messenger ---
    await Promise.all([
      pageA.goto(`${BASE}/messenger`),
      pageB.goto(`${BASE}/messenger`),
    ]);
    // Wait until each conversation list has rendered.
    await Promise.all([
      pageA.waitForSelector('[data-testid="conversation-list"], aside', { timeout: 10_000 }).catch(() => {}),
      pageB.waitForSelector('[data-testid="conversation-list"], aside', { timeout: 10_000 }).catch(() => {}),
    ]);

    // --- Open the shared conversation on both sides ---
    // We rely on the conversation name including the other user's display.
    const aOpen = await pageA.getByText(USER_B_EMAIL.split('@')[0], { exact: false }).first();
    await aOpen.click({ timeout: 5_000 });
    const bOpen = await pageB.getByText(USER_A_EMAIL.split('@')[0], { exact: false }).first();
    await bOpen.click({ timeout: 5_000 });

    // --- A clicks the voice-call button ---
    await pageA.getByRole('button', { name: /start voice call/i }).click();

    // --- A sees the outgoing ringing screen ---
    await expect(pageA.getByText(/calling\.\.\./i)).toBeVisible({ timeout: 8_000 });
    // Cancel button should be focused and operable.
    const cancelBtn = pageA.getByRole('button', { name: /cancel call/i });
    await expect(cancelBtn).toBeVisible();

    // --- B sees the incoming-call toast ---
    await expect(pageB.getByText(/incoming voice call/i)).toBeVisible({ timeout: 8_000 });
    const acceptBtn = pageB.getByRole('button', { name: /accept/i });
    await expect(acceptBtn).toBeVisible();
    await acceptBtn.click();

    // --- A's screen transitions to active (timer chip mm:ss) ---
    await expect(pageA.getByLabel(/call duration/i)).toBeVisible({ timeout: 10_000 });

    // --- A hangs up ---
    await pageA.getByRole('button', { name: /hang up/i }).click();

    // --- Both see the system message ---
    await expect(pageA.getByText(/Voice Call Ended/i)).toBeVisible({ timeout: 10_000 });
    await expect(pageB.getByText(/Voice Call Ended/i)).toBeVisible({ timeout: 10_000 });

    await ctxA.close();
    await ctxB.close();
  });
});
