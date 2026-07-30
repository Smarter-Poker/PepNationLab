import { chromium } from 'playwright';

(async () => {
  console.log("Launching browser...");
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1200, height: 1600 });
  console.log("Navigating to local dev server...");
  // Let's navigate to the test card page which isolated just the PremiumPeptideCard
  await page.goto('http://localhost:3000/test-card', { waitUntil: 'networkidle' });
  // Wait a bit for images to load
  await page.waitForTimeout(3000);
  console.log("Taking screenshot...");
  await page.screenshot({ path: 'local_live_screenshot.png', fullPage: true });
  await browser.close();
  console.log("Done!");
})();
