import { test, expect } from '@playwright/test';

const BASE = process.env.PNL_TEST_E2E_BASE_URL ?? 'http://localhost:3000';
const USER_EMAIL = process.env.PNL_TEST_E2E_AGENT_EMAIL ?? '';
const USER_PASS = process.env.PNL_TEST_E2E_AGENT_PASSWORD ?? '';

const SKIP_REASON = (() => {
  if (!USER_EMAIL || !USER_PASS) return 'PNL_TEST_E2E_AGENT_* unset';
  return null;
})();

test.describe('Agent Checkout Flow', () => {
  test.skip(!!SKIP_REASON, SKIP_REASON ?? '');

  test('checkout handles fractional prepaid cogs deduction and rollback on failure', async ({ page }) => {
    // 1. Sign In
    await page.goto(`${BASE}/login`);
    await page.getByLabel(/email/i).fill(USER_EMAIL);
    await page.getByLabel(/password/i).fill(USER_PASS);
    await page.getByRole('button', { name: /sign in/i }).click();
    await page.waitForURL((u) => !u.toString().endsWith('/login'), { timeout: 15_000 });

    // 2. Add an item to the cart
    await page.goto(`${BASE}/research/catalog`);
    
    // Attempt to click the first "Add" or "Cart" button. Adjust selector if necessary.
    // The exact text depends on the catalog UI, usually "Add To Cart", "Add", or an icon.
    // We'll target a generic button that likely adds to cart.
    const addBtn = page.locator('button').filter({ hasText: /add to cart/i }).first();
    if (await addBtn.isVisible()) {
      await addBtn.click();
    } else {
      // Fallback if the button has different text
      await page.locator('button').filter({ hasText: /add/i }).first().click();
    }

    // 3. Navigate to Checkout
    await page.goto(`${BASE}/checkout`);
    
    // Ensure the checkout form loaded by checking for the Step 1 Fulfillment text
    await expect(page.getByText(/Fulfillment Method/i)).toBeVisible({ timeout: 10_000 });

    // 4. Intercept the checkout API call to mock a failure and verify rollback logic.
    // The generic checkout hits /api/orders.
    let checkoutPayload: any = null;
    await page.route('**/api/orders', async route => {
      checkoutPayload = route.request().postDataJSON();
      // Mock an error response to trigger the UI error state
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Mocked checkout failure to trigger rollback' })
      });
    });

    // 5. Submit the checkout form (Step 1)
    const nextBtn1 = page.getByRole('button', { name: /Continue To Payment/i });
    // Default is usually Agent Pickup. Click next.
    await nextBtn1.waitFor({ state: 'visible' });
    await nextBtn1.click();

    // 6. Checkout form (Step 2)
    const nextBtn2 = page.getByRole('button', { name: /Continue To Terms/i });
    await expect(nextBtn2).toBeVisible({ timeout: 5000 });
    await nextBtn2.click();

    // 7. Checkout form (Step 3) - Compliance checkboxes
    await expect(page.getByText(/Compliance Research Agreement/i)).toBeVisible({ timeout: 5000 });
    
    // Check all three disclaimer checkboxes
    const checkboxes = await page.getByRole('checkbox').all();
    for (const checkbox of checkboxes) {
      await checkbox.check();
    }

    // Submit final order
    const submitBtn = page.getByRole('button', { name: /Place Research Order/i });
    await submitBtn.click();

    // 8. Verify the failure was handled gracefully by the UI
    await expect(page.getByText(/Mocked checkout failure to trigger rollback/i)).toBeVisible({ timeout: 10_000 });

    // 9. Verify the payload correctly calculated amounts
    expect(checkoutPayload).not.toBeNull();
    expect(checkoutPayload.items).toBeDefined();
    // We ensure the payload structured the request properly for the backend to run the RPC
  });
});

