import { chromium } from 'playwright';
import fs from 'fs';

(async () => {
  const html = `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@600;800&family=Roboto+Condensed:wght@700&display=swap" rel="stylesheet">
    <style>
      :root {
        --font-montserrat: 'Montserrat', sans-serif;
        --font-roboto-condensed: 'Roboto Condensed', sans-serif;
      }
      body {
        margin: 0; padding: 40px; background: #000; color: #fff;
        display: flex; gap: 20px; flex-wrap: wrap; justify-content: center;
      }
    </style>
  </head>
  <body>
    <div style="width: 100%; max-width: 400px;">
      <div style="container-type: inline-size; width: 100%; max-width: 675px; margin: 0 auto; cursor: pointer;">
        <div style="position: relative; width: 100%; padding-bottom: 149.18518%; overflow: hidden; font-family: var(--font-sans, sans-serif); transition: transform 0.2s;">
          
          <img src="file:///Users/smarter.poker/Documents/pepnationlab/public/images/storefront/premium-card-bg.jpg" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; z-index: 0;" />

          <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; z-index: 10;">
            
            <div style="position: absolute; left: 50%; top: calc(61 * 100cqi / 675); height: calc(427 * 100cqi / 675); width: calc(290 * 100cqi / 675); transform: translateX(-50%) rotate(9deg); z-index: 20;">
              <img src="https://pepnationlab.com/images/savage-brands/tirzepatide.png" style="width: 100%; height: 100%; object-fit: contain; filter: drop-shadow(0 calc(20 * 100cqi / 675) calc(20 * 100cqi / 675) rgba(0,0,0,0.9));" />
            </div>

            <div style="position: absolute; left: calc(77 * 100cqi / 675); top: calc(575 * 100cqi / 675); width: calc(300 * 100cqi / 675); z-index: 30; pointer-events: none;">
              <h2 style="margin: 0; font-family: var(--font-montserrat, sans-serif); font-weight: 600; font-size: calc(43 * 100cqi / 675); color: #D5D7D8; line-height: 1.1; text-shadow: 0 calc(4 * 100cqi / 675) calc(6 * 100cqi / 675) rgba(0,0,0,0.8);">Tirzepatide</h2>
            </div>

            <div style="position: absolute; left: calc(50 * 100cqi / 675); top: calc(648 * 100cqi / 675); width: calc(315 * 100cqi / 675); height: calc(82 * 100cqi / 675); display: flex; align-items: center; justify-content: center; z-index: 30; pointer-events: none;">
              <span style="font-family: var(--font-montserrat, sans-serif); font-weight: 600; font-size: calc(35 * 100cqi / 675); color: #D5D7D8; text-shadow: 0 calc(2 * 100cqi / 675) calc(4 * 100cqi / 675) rgba(0,0,0,0.5);">10mg Vials</span>
            </div>

            <div style="position: absolute; left: calc(406 * 100cqi / 675); top: calc(582 * 100cqi / 675); display: flex; align-items: baseline; gap: calc(8 * 100cqi / 675); z-index: 30; pointer-events: none;">
              <span style="font-family: var(--font-roboto-condensed, sans-serif); font-weight: 700; font-size: calc(22 * 100cqi / 675); color: #8B8F93;">MSRP</span>
              <span style="font-family: var(--font-roboto-condensed, sans-serif); font-weight: 700; font-size: calc(25 * 100cqi / 675); color: #8B8F93; text-decoration: line-through; text-decoration-thickness: calc(2 * 100cqi / 675);">$55.00</span>
            </div>

            <div style="position: absolute; left: calc(406 * 100cqi / 675); top: calc(629 * 100cqi / 675); font-family: var(--font-roboto-condensed, sans-serif); font-weight: 700; font-size: calc(23 * 100cqi / 675); color: #00C7E8; text-transform: uppercase; z-index: 30; pointer-events: none;">
              YOU SAVE $25
            </div>

            <div style="position: absolute; left: calc(406 * 100cqi / 675); top: calc(706 * 100cqi / 675); font-family: var(--font-roboto-condensed, sans-serif); font-weight: 700; font-size: calc(62 * 100cqi / 675); color: #00BFD8; line-height: 1; text-shadow: 0 calc(4 * 100cqi / 675) calc(10 * 100cqi / 675) rgba(0,0,0,0.5); z-index: 30; pointer-events: none;">
              $29.97
            </div>

          </div>
        </div>
      </div>
    </div>
  </body>
  </html>
  `;
  
  fs.writeFileSync('preview-grid.html', html);
  
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setViewportSize({ width: 600, height: 1200 });
  await page.setContent(html, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000); 
  await page.screenshot({ path: 'new_bg_card.png', fullPage: true });
  await browser.close();
})();
