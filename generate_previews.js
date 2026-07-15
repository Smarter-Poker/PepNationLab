const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  // Savage Brands HTML
  const savageHtml = `
    <!DOCTYPE html>
    <html>
    <head>
    <style>
      body { margin: 0; padding: 0; background: #050505; }
    </style>
    </head>
    <body>
      <div style="width: 788px; height: 300px; transform: scale(1); transform-origin: top left; background-color: #050505; font-family: 'Arial Black', Impact, 'Helvetica Neue', sans-serif; display: flex; position: relative; overflow: hidden; border-top: 12px solid #00d2ff; border-bottom: 12px solid #00d2ff; box-sizing: border-box;">
        
        <div style="width: 330px; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 20px;">
          <img src="file:///Users/smarter.poker/Documents/pepnationlab/public/images/logo-savage.jpg" style="width: 100%; height: 100%; object-fit: contain;" alt="logo" />
        </div>

        <div style="flex: 1; height: 100%; display: flex; flex-direction: column; justify-content: center; padding-top: 20px;">
          
          <div style="padding-right: 30px;">
            <div style="width: 100%; height: 4px; background: linear-gradient(to right, #ffffff 0%, #a0a0a0 50%, #ffffff 100%); margin-bottom: 8px; box-shadow: 0 1px 2px rgba(0,0,0,0.8);"></div>

            <div style="font-size: 110px; font-weight: 900; line-height: 1.1; text-transform: uppercase; background: linear-gradient(to bottom, #ffffff 0%, #d4d4d4 40%, #808080 50%, #c0c0c0 60%, #ffffff 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; filter: drop-shadow(2px 4px 6px rgba(0,0,0,0.9)); letter-spacing: -1px;">
              BPC-157
            </div>

            <div style="font-size: 38px; font-weight: 800; color: #a3a3a3; font-family: 'Arial Black', Impact, sans-serif; text-transform: uppercase; letter-spacing: 0px; margin-top: 0px; margin-bottom: 20px;">
              RESEARCH COMPOUND
            </div>
          </div>

          <div style="width: 100%; background-color: #00d2ff; padding: 12px 0; display: flex; align-items: center; justify-content: center; margin-left: -10px;">
            <div style="color: #000000; font-size: 32px; font-family: 'Helvetica Neue', Arial, sans-serif;">
              <span style="font-weight: 900;">10mg</span>
              <span style="font-weight: 500; margin: 0 8px;">-</span>
              <span style="font-weight: 500;">Research Compound</span>
            </div>
          </div>

        </div>
      </div>
    </body>
    </html>
  `;

  await page.setContent(savageHtml);
  await page.setViewport({ width: 788, height: 300 });
  await page.screenshot({ path: '/Users/smarter.poker/.gemini/antigravity/brain/b26182bb-4d5c-42b7-9fd2-cc939d229926/scratch/savage_preview.png' });

  // Pep Nation HTML
  const pepHtml = savageHtml.replace('logo-savage.jpg', '../logo.jpg');
  await page.setContent(pepHtml);
  await page.screenshot({ path: '/Users/smarter.poker/.gemini/antigravity/brain/b26182bb-4d5c-42b7-9fd2-cc939d229926/scratch/pep_preview.png' });

  await browser.close();
})();
