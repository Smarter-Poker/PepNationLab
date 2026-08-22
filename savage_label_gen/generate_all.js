const path = require("path");

const { createClient } = require('@supabase/supabase-js');
const puppeteer = require('puppeteer');
const fs = require('fs');
require('dotenv').config({ path: '../.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const bgBuffer = fs.readFileSync('true_perfect_blank4.png');
const bgBase64 = bgBuffer.toString('base64');

// Use transparent cyan claws
const clawsBuffer = fs.readFileSync('correct_claws_cyan.png');
const clawsBase64 = clawsBuffer.toString('base64');

const htmlTemplate = `
<!DOCTYPE html>
<html>
<head>
<link href="https://fonts.googleapis.com/css2?family=Anton&display=swap" rel="stylesheet">
<style>
  body {
    margin: 0;
    padding: 0;
    width: 1024px;
    height: 512px;
    background-image: url('data:image/png;base64,${bgBase64}');
    background-size: 1024px 512px;
    position: relative;
    overflow: hidden;
  }
  
  .badge-metal-text {
    font-family: 'Anton', sans-serif;
    transform: skewX(-12deg);
    text-transform: uppercase;
    text-align: center;
    white-space: nowrap;
    
    /* Use smooth gradient without harsh lines */
    background: linear-gradient(180deg, #FFFFFF 0%, #D0D0D0 50%, #A0A0A0 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    filter: drop-shadow(0px 8px 6px rgba(0, 0, 0, 0.9));
    -webkit-text-stroke: 3px #111111;
  }
  
  .smooth-metal-text {
    font-family: 'Anton', sans-serif;
    text-transform: uppercase;
    text-align: center;
    white-space: nowrap;
    
    background: linear-gradient(180deg, #FFFFFF 0%, #D0D0D0 50%, #A0A0A0 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    -webkit-text-stroke: 1px #111111;
    filter: drop-shadow(0px 4px 4px rgba(0, 0, 0, 0.5));
  }

  .white-text {
    font-family: 'Anton', sans-serif;
    text-transform: uppercase;
    text-align: center;
    white-space: nowrap;
    color: #FFFFFF;
    -webkit-text-stroke: 1px #000000;
  }

  .title-container {
    position: absolute;
    /* Vertically perfectly centered between logo (y=270) and teal bar (y=422) */
    top: 270px;
    height: 152px;
    width: 1024px;
    left: 0px;
    display: flex;
    justify-content: center;
    align-items: center;
  }
  
  .title {
    font-size: 110px;
    letter-spacing: -1px;
  }
  
  .bottom-text-container {
    position: absolute;
    bottom: 0px;
    height: 90px;
    width: 1024px;
    left: 0px;
    display: flex;
    justify-content: center;
    align-items: center;
  }

  .bottom-text {
    font-size: 65px;
    letter-spacing: 2px;
  }

  .badge-container {
    position: absolute;
    /* Raised from 151px to 115px to perfectly balance the visual space */
    top: 115px;
    /* Increased container size for slightly larger claws */
    width: 215px;
    height: 215px;
    display: flex;
    justify-content: center;
    align-items: center;
  }

  .badge-bg {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-image: url('data:image/png;base64,${clawsBase64}');
    background-size: cover;
    background-repeat: no-repeat;
    background-position: center;
    z-index: 1;
  }

  .badge-left { 
    /* Set to 0 to fill the left black space (x=0 to 215) */
    left: 0px; 
  }
  
  .badge-right { 
    /* Set to 0 to fill the right black space (x=809 to 1024) */
    right: 0px; 
  }

  .dose {
    position: relative;
    z-index: 10;
    /* Increased font size so the size is slightly larger */
    font-size: 92px;
    letter-spacing: 1px;
    line-height: 1;
    top: 5px; 
  }
</style>
</head>
<body>
  <div class="badge-container badge-left">
    <div class="badge-bg"></div>
    <div class="badge-metal-text dose" id="dose1"></div>
  </div>
  
  <div class="badge-container badge-right">
    <div class="badge-bg"></div>
    <div class="badge-metal-text dose" id="dose2"></div>
  </div>

  <div class="title-container">
    <div class="smooth-metal-text title" id="title"></div>
  </div>
  
  <div class="bottom-text-container">
    <div class="white-text bottom-text">FOR RESEARCH USE ONLY</div>
  </div>
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

  const products = ap;
  
  console.log(`Found ${products.length} products to generate. Launching puppeteer...`);
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.setViewport({ width: 1024, height: 512, deviceScaleFactor: 1 });

  // Set the base HTML content exactly once to prevent memory/base64 parsing issues
  await page.setContent(htmlTemplate, { waitUntil: 'domcontentloaded' });
  
  // Wait for fonts to load
  await page.evaluate(async () => {
    await document.fonts.ready;
  });

  for (let i = 0; i < products.length; i++) {
    const product = products[i].products;
    if (!product || !product.slug) continue;
    
    let doseText = '';
    if (product.unit_size && product.unit_measure) {
      doseText = `${product.unit_size}${product.unit_measure.toUpperCase()}`;
    }
    
    // Dynamically update text and trigger resizing logic in the browser context
    await page.evaluate((titleText, doseTextStr) => {
      const title = document.getElementById('title');
      const dose1 = document.getElementById('dose1');
      const dose2 = document.getElementById('dose2');
      const titleContainer = document.querySelector('.title-container');
      const container = document.querySelector('.badge-left');

      // Set text
      title.textContent = titleText;
      dose1.textContent = doseTextStr;
      dose2.textContent = doseTextStr;

      // Reset sizes before computing layout
      title.style.fontSize = '110px';
      dose1.style.fontSize = '80px';
      dose2.style.fontSize = '80px';

      // Recompute Title Size
      let fontSize = 110;
      while (title.scrollWidth > titleContainer.clientWidth && fontSize > 30) {
        fontSize -= 2;
        title.style.fontSize = fontSize + 'px';
      }

      // Recompute Dose Size
      let doseSize = 80;
      while (dose1.scrollWidth > (container.clientWidth - 10) && doseSize > 20) {
        doseSize -= 1;
        dose1.style.fontSize = doseSize + 'px';
        dose2.style.fontSize = doseSize + 'px';
      }
    }, product.name, doseText);
    
    const buffer = await page.screenshot({ type: 'png' });
    
    const slug = product.slug || product.name.replace(/\s+/g, '-').toLowerCase();
    
    const outputPath = path.join(__dirname, '..', 'public', 'images', 'savage-brands', `${slug}.png`);
    require('fs').writeFileSync(outputPath, buffer);
    console.log(`[${i+1}/${products.length}] Saved locally to ${outputPath}`);
  }

  await browser.close();
  console.log('Done!');
}

run().catch(console.error);
