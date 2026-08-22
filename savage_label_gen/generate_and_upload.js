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

const clawsBuffer = fs.readFileSync('correct_claws_cyan.png');
const clawsBase64 = clawsBuffer.toString('base64');

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
    background-image: url('data:image/png;base64,${bgBase64}');
    background-size: 1024px 512px;
    position: relative;
    overflow: hidden;
  }
  
  .metal-text {
    font-family: 'Anton', sans-serif;
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
  }

  .title-container {
    position: absolute;
    top: 290px;
    height: 120px;
    width: 860px;
    left: 82px;
    display: flex;
    justify-content: center;
    align-items: center;
  }
  
  .title {
    font-size: 110px;
    letter-spacing: -1px;
    -webkit-text-stroke: 3px #111111;
  }
  
  .badge-container {
    position: absolute;
    top: 140px;
    width: 240px;
    height: 210px;
    display: flex;
    justify-content: center;
    align-items: center;
  }

  .badge-left { 
    left: 10px; 
    background-image: url('data:image/png;base64,${clawsBase64}');
    background-size: contain;
    background-repeat: no-repeat;
    background-position: center;
  }
  
  .badge-right { 
    right: 10px; 
    background-image: url('data:image/png;base64,${clawsBase64}');
    background-size: contain;
    background-repeat: no-repeat;
    background-position: center;
    transform: scaleX(-1);
  }

  .badge-right .dose {
    transform: scaleX(-1);
  }

  .dose {
    font-family: 'Teko', sans-serif;
    font-weight: 700;
    font-size: 125px; 
    letter-spacing: 2px;
    -webkit-text-stroke: 1px #111111; 
  }
</style>
</head>
<body>
  <div class="badge-container badge-left">
    <div class="metal-text dose" id="dose1">DOSE_TEXT</div>
  </div>
  
  <div class="title-container">
    <div class="metal-text title" id="title">TITLE_TEXT</div>
  </div>

  <div class="badge-container badge-right">
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
      const doseContainer = document.querySelector('.badge-left');
      let doseSize = 125;
      while (dose1.scrollWidth > (doseContainer.clientWidth - 30) && doseSize > 30) {
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
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.setViewport({ width: 1024, height: 512, deviceScaleFactor: 1 });

  let successCount = 0;
  
  for (let i = 0; i < ap.length; i++) {
    const product = ap[i].products;
    if (!product || !product.slug) continue;
    
    let doseText = '';
    if (product.unit_size && product.unit_measure) {
      doseText = `${product.unit_size}${product.unit_measure.toUpperCase()}`;
    }
    
    const slug = product.slug || product.name.replace(/\s+/g, '-').toLowerCase();
    const safeSlug = slug.replace(/\//g, '_').replace(/ /g, '_');

    const html = htmlTemplate
      .replace(/TITLE_TEXT/g, product.name)
      .replace(/DOSE_TEXT/g, doseText);
      
    const newPage = await browser.newPage();
    await newPage.setViewport({ width: 1024, height: 512, deviceScaleFactor: 1 });
    await newPage.setContent(html, { waitUntil: 'domcontentloaded' });
    await newPage.waitForSelector('#ready', { timeout: 10000 });
    
    const buffer = await newPage.screenshot({ type: 'png' });
    await newPage.close();
    
    // Upload to Supabase
    const filePath = `savage/${safeSlug}.png`;
    
    let retries = 3;
    let uploaded = false;
    
    while (retries > 0 && !uploaded) {
      const { data, error: uploadError } = await supabase.storage
        .from('print-labels')
        .upload(filePath, buffer, {
          contentType: 'image/png',
          upsert: true
        });
        
      if (uploadError) {
        console.error(`Failed to upload ${filePath}, retries left: ${retries - 1}. Error:`, uploadError.message);
        retries--;
        await new Promise(r => setTimeout(r, 2000));
      } else {
        console.log(`[${i + 1}/${ap.length}] Uploaded ${filePath}`);
        successCount++;
        uploaded = true;
      }
    }
  }

  await browser.close();
  console.log(`Done! Successfully generated and uploaded ${successCount} labels.`);
}

run().catch(console.error);
