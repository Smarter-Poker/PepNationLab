import { chromium } from 'playwright';
import fs from 'fs';

(async () => {
  const html = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=683, initial-scale=1">
    <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@600;700;800&family=Roboto+Condensed:wght@700&display=swap" rel="stylesheet">
    <style>
      :root {
        --font-montserrat: 'Montserrat', sans-serif;
        --font-roboto-condensed: 'Roboto Condensed', sans-serif;
      }
      body {
        margin: 0; padding: 0; background: transparent; overflow: hidden;
        width: 683px; height: 1024px;
      }
    </style>
  </head>
  <body>
    <div style="width: 683px; height: 1024px; position: relative;">
      <!-- EXACT TEMPLATE BACKGROUND -->
      <img src="file:///Users/smarter.poker/Documents/pepnationlab/public/images/storefront/premium-card-bg-2.jpg" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; z-index: 0;" />
      
      <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; z-index: 10;">
        
        <!-- VIAL IMAGE - STRAIGHT -->
        <div style="position: absolute; left: 50%; top: 60px; height: 420px; width: 290px; transform: translateX(-50%); z-index: 20;">
          <img src="https://pepnationlab.com/images/savage-brands/tirzepatide.png" style="width: 100%; height: 100%; object-fit: contain; filter: drop-shadow(0 20px 20px rgba(0,0,0,0.9));" />
        </div>
        
        <!-- PEPTIDE NAME -->
        <div style="position: absolute; left: 60px; top: 580px; width: 320px; z-index: 30; pointer-events: none;">
          <h2 style="margin: 0; font-family: var(--font-montserrat, sans-serif); font-weight: 700; font-size: 44px; color: #E2E4E6; line-height: 1.1; text-shadow: 0 4px 6px rgba(0,0,0,0.8); text-transform: uppercase;">Tirzepatide</h2>
        </div>
        
        <!-- WEIGHT INSIDE THE PILL -->
        <!-- Center exactly inside the pill box found at x=51, y=664, w=319, h=89 -->
        <div style="position: absolute; left: 51px; top: 664px; width: 319px; height: 89px; display: flex; align-items: center; justify-content: center; z-index: 30; pointer-events: none;">
          <span style="font-family: var(--font-montserrat, sans-serif); font-weight: 800; font-size: 34px; color: #FFFFFF; text-shadow: 0 2px 4px rgba(0,0,0,0.8); letter-spacing: 1px;">10MG VIAL</span>
        </div>
        
        <!-- MSRP -->
        <!-- Placed around top: 590px, on the right side -->
        <div style="position: absolute; left: 410px; top: 590px; display: flex; align-items: baseline; gap: 8px; z-index: 30; pointer-events: none;">
          <span style="font-family: var(--font-roboto-condensed, sans-serif); font-weight: 700; font-size: 22px; color: #8B8F93;">MSRP</span>
          <span style="font-family: var(--font-roboto-condensed, sans-serif); font-weight: 700; font-size: 25px; color: #8B8F93; text-decoration: line-through; text-decoration-thickness: 2px;">$55.00</span>
        </div>
        
        <!-- SAVINGS -->
        <!-- Placed around top: 635px -->
        <div style="position: absolute; left: 410px; top: 635px; font-family: var(--font-roboto-condensed, sans-serif); font-weight: 700; font-size: 23px; color: #00C7E8; text-transform: uppercase; z-index: 30; pointer-events: none;">
          YOU SAVE $25
        </div>
        
        <!-- WHOLESALE PRICE -->
        <!-- Placed below the printed WHOLESALE PRICE label (which is at top 684) -->
        <div style="position: absolute; left: 410px; top: 710px; font-family: var(--font-roboto-condensed, sans-serif); font-weight: 700; font-size: 65px; color: #00D5F2; line-height: 1; text-shadow: 0 4px 10px rgba(0,0,0,0.5); z-index: 30; pointer-events: none;">
          $29.97
        </div>

      </div>
    </div>
  </body>
  </html>
  `;
  
  fs.writeFileSync('preview-grid6.html', html);
  
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setViewportSize({ width: 683, height: 1024 });
  await page.setContent(html, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000); 
  await page.screenshot({ path: 'fixed_template_mockup.png', omitBackground: true, clip: { x: 0, y: 0, width: 683, height: 1024 } });
  await browser.close();
})();
