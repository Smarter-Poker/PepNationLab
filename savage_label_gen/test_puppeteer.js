const puppeteer = require('puppeteer');
const fs = require('fs');

async function run() {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  // Set viewport to the exact size of our label
  await page.setViewport({ width: 1024, height: 512, deviceScaleFactor: 1 });
  
  const html = fs.readFileSync('index.html', 'utf8');
  await page.setContent(html, { waitUntil: 'networkidle0' });
  
  // Wait a bit just in case fonts need rendering
  await new Promise(r => setTimeout(r, 500));
  
  await page.screenshot({ path: 'test_render.png' });
  await browser.close();
  console.log('Saved test_render.png');
}

run().catch(console.error);
