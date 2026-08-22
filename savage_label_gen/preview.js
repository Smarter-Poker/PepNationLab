const { createClient } = require('@supabase/supabase-js');
const puppeteer = require('puppeteer');
const fs = require('fs');
require('dotenv').config({ path: '../.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const bgBuffer = fs.readFileSync('perfect_blank.png');
const bgBase64 = bgBuffer.toString('base64');

const htmlTemplate = `
<!DOCTYPE html>
<html>
<head>
<link href="https://fonts.googleapis.com/css2?family=Anton&family=Teko:wght@700&display=swap" rel="stylesheet">
<style>
  body {
    margin: 0;
    padding: 0;
    width: 1024px;
    height: 512px;
    background-image: url('data:image/png;base64,\${bgBase64}');
    background-size: 1024px 512px;
    position: relative;
    overflow: hidden;
  }
  
  .metal-text {
    font-family: 'Anton', sans-serif;
    transform: skewX(-12deg);
    text-transform: uppercase;
    text-align: center;
    white-space: nowrap;
    
    background: linear-gradient(
      180deg,
      #F0F0F0 0%,
      #FFFFFF 25%,
      #A0A0A0 45%,
      #606060 50%,
      #E0E0E0 65%,
      #FFFFFF 85%,
      #909090 100%
    );
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    
    filter: drop-shadow(0px 8px 6px rgba(0, 0, 0, 0.9))
            drop-shadow(0px 0px 4px #00C4BC);
    -webkit-text-stroke: 3px #111111;
  }

  .title-container {
    position: absolute;
    bottom: 95px;
    width: 860px;
    left: 82px;
    display: flex;
    justify-content: center;
    align-items: center;
  }
  
  .title {
    font-size: 110px;
    letter-spacing: -1px;
    transform: skewX(-15deg);
  }
  
  .dose-container {
    position: absolute;
    top: 155px;
    width: 200px;
    display: flex;
    justify-content: center;
    align-items: center;
  }

  .dose-left { left: 40px; }
  .dose-right { right: 40px; }

  .dose {
    font-family: 'Teko', sans-serif;
    font-weight: 700;
    font-size: 110px;
    transform: skewX(-10deg);
    letter-spacing: 2px;
  }
</style>
</head>
<body>
  <div class="dose-container dose-left">
    <div class="metal-text dose" id="dose1">DOSE_TEXT</div>
  </div>
  
  <div class="title-container">
    <div class="metal-text title" id="title">TITLE_TEXT</div>
  </div>

  <div class="dose-container dose-right">
    <div class="metal-text dose" id="dose2">DOSE_TEXT</div>
  </div>

  <script>
    async function init() {
      await document.fonts.ready;
      
      const title = document.getElementById('title');
      const titleContainer = document.querySelector('.title-container');
      let fontSize = 110;
      while (title.scrollWidth > titleContainer.clientWidth && fontSize > 30) {
        fontSize -= 2;
        title.style.fontSize = fontSize + 'px';
      }

      const dose1 = document.getElementById('dose1');
      const dose2 = document.getElementById('dose2');
      const doseContainer = document.querySelector('.dose-left');
      let doseSize = 110;
      while (dose1.scrollWidth > doseContainer.clientWidth && doseSize > 30) {
        doseSize -= 2;
        dose1.style.fontSize = doseSize + 'px';
        dose2.style.fontSize = doseSize + 'px';
      }
      
      const el = document.createElement('div');
      el.id = 'ready';
      document.body.appendChild(el);
    }
    init();
  </script>
</body>
</html>
`;

async function run() {
  console.log('Fetching Savage Brands products...');
  const { data: agent } = await supabase.from('agent_profiles').select('id').eq('slug', 'savagebrands').single();
  const { data: ap, error } = await supabase.from('agent_products').select('product_id, products(slug, name, unit_size, unit_measure)').eq('agent_id', agent.id);
  
  if (error) {
    console.error('Error fetching products:', error);
    return;
  }

  console.log(`Found ${ap.length} products. Launching puppeteer...`);
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setViewport({ width: 1024, height: 512, deviceScaleFactor: 1 });

  // Only do the first 5
  for (let i = 0; i < 5; i++) {
    const product = ap[i].products;
    if (!product || !product.slug) continue;
    
    let doseText = '';
    if (product.unit_size && product.unit_measure) {
      doseText = `${product.unit_size}${product.unit_measure.toUpperCase()}`;
    }

    const html = htmlTemplate
      .replace(/TITLE_TEXT/g, product.name)
      .replace(/DOSE_TEXT/g, doseText);

    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#ready', { timeout: 10000 });
    
    const destPath = `/Users/smarter.poker/.gemini/antigravity/brain/eeb57b10-9e7d-4419-898d-427b198a8e6e/preview_${i+1}.png`;
    await page.screenshot({ path: destPath, type: 'png' });
    console.log(`Saved ${destPath}`);
  }

  await browser.close();
}

run().catch(console.error);
