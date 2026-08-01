const { createClient } = require('@supabase/supabase-js');
const puppeteer = require('puppeteer');
const fs = require('fs');
require('dotenv').config({ path: '../.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const bgBuffer = fs.readFileSync('savage-blank-template.png');
const bgBase64 = bgBuffer.toString('base64');

const htmlTemplate = `
<!DOCTYPE html>
<html>
<head>
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
    font-family: 'Impact', sans-serif;
    font-style: italic;
    transform: skewX(-8deg);
    text-transform: uppercase;
    text-align: center;
    white-space: nowrap;
    
    background: linear-gradient(
      180deg,
      #EAEAEA 0%,
      #FFFFFF 20%,
      #909090 40%,
      #505050 50%,
      #D0D0D0 60%,
      #FFFFFF 80%,
      #808080 100%
    );
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    
    filter: drop-shadow(0px 8px 10px rgba(0, 0, 0, 0.9))
            drop-shadow(0px 2px 4px rgba(0, 0, 0, 0.7));
    -webkit-text-stroke: 4px #1A1A1A;
  }

  .title-container {
    position: absolute;
    bottom: 120px;
    width: 900px;
    left: 62px;
    display: flex;
    justify-content: center;
    align-items: center;
  }
  
  .title {
    font-size: 100px;
    letter-spacing: -2px;
  }
  
  .dose-container {
    position: absolute;
    top: 200px;
    width: 200px;
    display: flex;
    justify-content: center;
    align-items: center;
  }

  .dose-left {
    left: 40px;
  }
  
  .dose-right {
    right: 40px;
  }

  .dose {
    font-size: 80px;
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
    // Resize title if it overflows
    const title = document.getElementById('title');
    const titleContainer = document.querySelector('.title-container');
    let fontSize = 100;
    while (title.scrollWidth > titleContainer.clientWidth && fontSize > 20) {
      fontSize -= 2;
      title.style.fontSize = fontSize + 'px';
    }

    // Resize doses if they overflow
    const dose1 = document.getElementById('dose1');
    const dose2 = document.getElementById('dose2');
    const doseContainer = document.querySelector('.dose-left');
    let doseSize = 80;
    while (dose1.scrollWidth > doseContainer.clientWidth && doseSize > 20) {
      doseSize -= 2;
      dose1.style.fontSize = doseSize + 'px';
      dose2.style.fontSize = doseSize + 'px';
    }
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

  let successCount = 0;

  for (let i = 0; i < ap.length; i++) {
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
    
    // Wait for JS resize to apply
    await new Promise(r => setTimeout(r, 50));
    
    const buffer = await page.screenshot({ type: 'png' });
    
    const filePath = `savage/${product.slug}.png`;
    
    console.log(`[${i+1}/${ap.length}] Uploading ${filePath} (${product.name} ${doseText})...`);
    
    const { data: uploadData, error: uploadError } = await supabase
      .storage
      .from('print-labels')
      .upload(filePath, buffer, {
        contentType: 'image/png',
        upsert: true
      });

    if (uploadError) {
      console.error(`Failed to upload ${filePath}:`, uploadError);
    } else {
      successCount++;
    }
  }

  await browser.close();
  console.log(`Done! Successfully uploaded ${successCount} labels.`);
}

run().catch(console.error);
