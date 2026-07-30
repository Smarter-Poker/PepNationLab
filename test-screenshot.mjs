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
    <!-- Simulate what AgentStorefrontGrid does when rendering PremiumPeptideCard -->
    <div style="width: 100%; max-width: 400px;">
      <!-- Inject Card HTML directly. 
           We will use the actual TSX output basically. -->
      <div style="container-type: inline-size; width: 100%; max-width: 675px; margin: 0 auto; cursor: pointer;">
        <div style="position: relative; width: 100%; padding-bottom: 149.18518%; background: #000; overflow: hidden; font-family: var(--font-sans, sans-serif); transition: transform 0.2s;">
          <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0;">
            
            <div style="position: absolute; left: calc(22 * 100cqi / 675); right: calc(21 * 100cqi / 675); top: calc(20 * 100cqi / 675); bottom: calc(12 * 100cqi / 675); border-radius: calc(31 * 100cqi / 675); background: #05090c; border: calc(4 * 100cqi / 675) solid #A5ACB4; box-shadow: inset 0 0 calc(40 * 100cqi / 675) rgba(0,0,0,0.9); overflow: hidden;">
              <div style="position: absolute; left: calc(8 * 100cqi / 675); right: calc(8 * 100cqi / 675); top: calc(8 * 100cqi / 675); bottom: calc(8 * 100cqi / 675); border-radius: calc(22 * 100cqi / 675); border: calc(2 * 100cqi / 675) solid #777B80; pointer-events: none; z-index: 100;"></div>
            </div>

            <div style="position: absolute; left: calc(26 * 100cqi / 675); right: calc(25 * 100cqi / 675); top: calc(24 * 100cqi / 675); height: calc(527 * 100cqi / 675); background: #020304; clip-path: polygon(0 0, 100% 0, 100% 100%, 50% calc(100% + calc(28 * 100cqi / 675)), 0 100%); z-index: 10; overflow: hidden; border-top-left-radius: calc(27 * 100cqi / 675); border-top-right-radius: calc(27 * 100cqi / 675);">
              <div style="position: absolute; top: 20%; left: 10%; right: 10%; bottom: 20%; background: radial-gradient(ellipse at center, rgba(0, 213, 242, 0.25) 0%, transparent 60%); filter: blur(calc(30 * 100cqi / 675));"></div>
              <div style="position: absolute; width: calc(220 * 100cqi / 675); height: calc(220 * 100cqi / 675); left: 50%; top: 50%; transform: translate(-50%, -50%); border-radius: 50%; border: calc(2 * 100cqi / 675) solid #00CDEB; box-shadow: 0 0 calc(40 * 100cqi / 675) rgba(0,205,235,0.6), inset 0 0 calc(40 * 100cqi / 675) rgba(0,205,235,0.6); opacity: 0.8;"></div>
              <div style="position: absolute; bottom: 0; left: 0; right: 0; height: calc(120 * 100cqi / 675); background: linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.8) 100%); z-index: 15;"></div>
              <div style="position: absolute; bottom: calc(10 * 100cqi / 675); left: 20%; right: 20%; height: calc(60 * 100cqi / 675); background: radial-gradient(ellipse at center, rgba(0, 205, 235, 0.4) 0%, transparent 70%); z-index: 16;"></div>
            </div>

            <div style="position: absolute; left: 50%; top: calc(61 * 100cqi / 675); height: calc(427 * 100cqi / 675); width: calc(290 * 100cqi / 675); transform: translateX(-50%) rotate(9deg); z-index: 20;">
              <!-- Vial Image Proxy for rendering -->
              <img src="https://pepnationlab.com/images/savage-brands/tirzepatide.png" style="width: 100%; height: 100%; object-fit: contain; filter: drop-shadow(0 calc(20 * 100cqi / 675) calc(20 * 100cqi / 675) rgba(0,0,0,0.9));" />
            </div>

            <div style="position: absolute; left: calc(56 * 100cqi / 675); top: calc(51 * 100cqi / 675); display: flex; flex-direction: column; align-items: center; z-index: 30;">
              <input type="checkbox" style="width: calc(33 * 100cqi / 675); height: calc(33 * 100cqi / 675); background-color: #05090C; border: calc(2 * 100cqi / 675) solid #777B80; border-radius: calc(6 * 100cqi / 675); margin-bottom: calc(4 * 100cqi / 675); cursor: pointer; accent-color: #00e5ff;" />
              <span style="font-family: var(--font-roboto-condensed); font-weight: 700; color: #FFFFFF; font-size: calc(17 * 100cqi / 675); letter-spacing: calc(0.5 * 100cqi / 675);">COMPARE</span>
            </div>

            <button type="button" style="position: absolute; left: calc(557 * 100cqi / 675); top: calc(48 * 100cqi / 675); width: calc(66 * 100cqi / 675); height: calc(66 * 100cqi / 675); background-color: #000000; border: calc(2 * 100cqi / 675) solid #777B80; border-radius: 50%; display: flex; align-items: center; justify-content: center; z-index: 30; cursor: pointer; padding: 0;">
              <svg width="calc(28 * 100cqi / 675)" height="calc(28 * 100cqi / 675)" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
              </svg>
            </button>

            <svg style="position: absolute; left: calc(35 * 100cqi / 675); right: calc(35 * 100cqi / 675); top: calc(520 * 100cqi / 675); height: calc(28 * 100cqi / 675); width: calc(100% - calc(70 * 100cqi / 675)); z-index: 25; filter: drop-shadow(0 calc(4 * 100cqi / 675) calc(6 * 100cqi / 675) rgba(0,0,0,0.9));" preserveAspectRatio="none" viewBox="0 0 605 28">
              <path d="M0,0 L302.5,28 L605,0 L605,28 L0,28 Z" fill="#11161A" stroke="#C0C5CA" stroke-width="2" />
            </svg>

            <div style="position: absolute; left: calc(26 * 100cqi / 675); right: calc(25 * 100cqi / 675); top: calc(548 * 100cqi / 675); bottom: calc(16 * 100cqi / 675); background: #11161A; z-index: 10; border-bottom-left-radius: calc(27 * 100cqi / 675); border-bottom-right-radius: calc(27 * 100cqi / 675);"></div>

            <div style="position: absolute; left: calc(77 * 100cqi / 675); top: calc(575 * 100cqi / 675); width: calc(300 * 100cqi / 675); z-index: 30;">
              <h2 style="margin: 0; font-family: var(--font-montserrat); font-weight: 600; font-size: calc(43 * 100cqi / 675); color: #D5D7D8; line-height: 1.1; text-shadow: 0 calc(4 * 100cqi / 675) calc(6 * 100cqi / 675) rgba(0,0,0,0.8);">Tirzepatide</h2>
            </div>

            <div style="position: absolute; left: calc(74 * 100cqi / 675); top: calc(650 * 100cqi / 675); width: calc(287 * 100cqi / 675); height: calc(78 * 100cqi / 675); border-radius: calc(20 * 100cqi / 675); border: calc(2 * 100cqi / 675) solid #8B8F93; background: #05090C; display: flex; align-items: center; justify-content: center; box-shadow: 0 calc(6 * 100cqi / 675) calc(12 * 100cqi / 675) rgba(0,0,0,0.6); z-index: 30;">
              <div style="position: absolute; inset: calc(2 * 100cqi / 675); border-radius: calc(17 * 100cqi / 675); border: calc(1 * 100cqi / 675) solid #292D31; pointer-events: none;"></div>
              <span style="font-family: var(--font-montserrat); font-weight: 600; font-size: calc(35 * 100cqi / 675); color: #D5D7D8; text-shadow: 0 calc(2 * 100cqi / 675) calc(4 * 100cqi / 675) rgba(0,0,0,0.5);">10mg Vials</span>
            </div>

            <div style="position: absolute; left: calc(395 * 100cqi / 675); top: calc(567 * 100cqi / 675); width: calc(2 * 100cqi / 675); height: calc(208 * 100cqi / 675); background: #777B80; z-index: 30;"></div>

            <div style="position: absolute; left: calc(431 * 100cqi / 675); top: calc(582 * 100cqi / 675); display: flex; align-items: baseline; gap: calc(8 * 100cqi / 675); z-index: 30;">
              <span style="font-family: var(--font-roboto-condensed); font-weight: 700; font-size: calc(22 * 100cqi / 675); color: #8B8F93;">MSRP</span>
              <span style="font-family: var(--font-roboto-condensed); font-weight: 700; font-size: calc(25 * 100cqi / 675); color: #8B8F93; text-decoration: line-through; text-decoration-thickness: calc(2 * 100cqi / 675);">$55.00</span>
            </div>
            <div style="position: absolute; left: calc(431 * 100cqi / 675); top: calc(629 * 100cqi / 675); font-family: var(--font-roboto-condensed); font-weight: 700; font-size: calc(23 * 100cqi / 675); color: #00C7E8; text-transform: uppercase; z-index: 30;">YOU SAVE $25</div>

            <div style="position: absolute; left: calc(428 * 100cqi / 675); top: calc(666 * 100cqi / 675); width: calc(188 * 100cqi / 675); height: calc(1 * 100cqi / 675); background: #006E7B; z-index: 30;"></div>
            <div style="position: absolute; left: calc(425 * 100cqi / 675); top: calc(681 * 100cqi / 675); font-family: var(--font-roboto-condensed); font-weight: 700; font-size: calc(19 * 100cqi / 675); color: #D5D7D8; z-index: 30;">WHOLESALE PRICE</div>
            <div style="position: absolute; left: calc(406 * 100cqi / 675); top: calc(706 * 100cqi / 675); font-family: var(--font-roboto-condensed); font-weight: 700; font-size: calc(62 * 100cqi / 675); color: #00BFD8; line-height: 1; text-shadow: 0 calc(4 * 100cqi / 675) calc(10 * 100cqi / 675) rgba(0,0,0,0.5); z-index: 30;">$29.97</div>

            <div style="position: absolute; left: calc(91 * 100cqi / 675); top: calc(792 * 100cqi / 675); width: calc(494 * 100cqi / 675); height: calc(95 * 100cqi / 675); border-radius: calc(47.5 * 100cqi / 675); background: #11161A; border: calc(3 * 100cqi / 675) solid #8B8F93; box-shadow: inset 0 calc(2 * 100cqi / 675) calc(4 * 100cqi / 675) rgba(255,255,255,0.1), 0 calc(6 * 100cqi / 675) calc(12 * 100cqi / 675) rgba(0,0,0,0.8); display: flex; align-items: center; justify-content: center; cursor: pointer; z-index: 30;">
              <div style="position: absolute; inset: calc(2 * 100cqi / 675); border-radius: calc(45 * 100cqi / 675); border: calc(1 * 100cqi / 675) solid #292D31; pointer-events: none;"></div>
              <div style="position: absolute; left: calc(6 * 100cqi / 675); top: calc(6 * 100cqi / 675); width: calc(83 * 100cqi / 675); height: calc(83 * 100cqi / 675); border-radius: 50%; border: calc(2 * 100cqi / 675) solid #8B8F93; display: flex; align-items: center; justify-content: center;">
                <svg width="calc(32 * 100cqi / 675)" height="calc(32 * 100cqi / 675)" viewBox="0 0 24 24" fill="none" stroke="#D5D7D8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
              </div>
              <span style="font-family: var(--font-montserrat); font-weight: 600; font-size: calc(39 * 100cqi / 675); color: #D5D7D8; letter-spacing: calc(0.5 * 100cqi / 675); text-shadow: 0 calc(2 * 100cqi / 675) calc(4 * 100cqi / 675) rgba(0,0,0,0.5); margin-left: calc(40 * 100cqi / 675);">Add To Cart</span>
            </div>

            <div style="position: absolute; left: calc(57 * 100cqi / 675); top: calc(906 * 100cqi / 675); width: calc(559 * 100cqi / 675); height: calc(56 * 100cqi / 675); background: #05080B; border: calc(2 * 100cqi / 675) solid #8B8F93; display: flex; align-items: center; box-shadow: inset 0 calc(4 * 100cqi / 675) calc(8 * 100cqi / 675) rgba(0,0,0,0.5); z-index: 30; border-radius: calc(6 * 100cqi / 675);">
              <div style="width: calc(230 * 100cqi / 675); display: flex; align-items: center; justify-content: center; gap: calc(12 * 100cqi / 675);">
                <svg width="calc(24 * 100cqi / 675)" height="calc(24 * 100cqi / 675)" viewBox="0 0 24 24" fill="none" stroke="#00D5F2" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
                <span style="font-family: var(--font-roboto-condensed); font-weight: 700; font-size: calc(24 * 100cqi / 675); color: #00D5F2; letter-spacing: calc(0.5 * 100cqi / 675);">IN STOCK</span>
              </div>
              <div style="width: calc(2 * 100cqi / 675); height: calc(34 * 100cqi / 675); background: #006E7B;"></div>
              <div style="flex: 1; display: flex; align-items: center; justify-content: center;">
                <span style="font-family: var(--font-roboto-condensed); font-weight: 700; font-size: calc(16 * 100cqi / 675); color: #D5D7D8; letter-spacing: calc(0.5 * 100cqi / 675);">AVAILABLE FOR SAME DAY PICKUP</span>
              </div>
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
  // Wait a bit for fonts and images to load fully
  await page.waitForTimeout(2000); 
  await page.screenshot({ path: 'new_grid_card.png', fullPage: true });
  await browser.close();
})();
