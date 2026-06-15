const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  try {
    const logs = [];
    page.on('console', msg => logs.push(msg.text()));
    
    await page.goto('http://localhost:3000/peptide-101');
    await page.waitForLoadState('networkidle');
    
    // Check if the landing page images are there
    const m1Visible = await page.isVisible('#m1p1');
    console.log('Is Module 1 visible? ', m1Visible);
    
    // Check if course-nav is visible and has items
    const navItems = await page.$$eval('.course-tab', els => els.length);
    console.log('Course nav items: ', navItems);
    
    // Check if there are JS errors
    console.log('Browser logs: ', logs);
  } catch (e) {
    console.error(e);
  } finally {
    await browser.close();
  }
})();
