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
const clawsBuffer = fs.readFileSync('correct_claws_cyan.png');
const clawsBase64 = clawsBuffer.toString('base64');

const htmlTemplate = `
<!DOCTYPE html>
<html>
<head>
<link href="https://fonts.googleapis.com/css2?family=Anton&display=swap" rel="stylesheet">
<style>
  body { margin: 0; padding: 0; width: 1024px; height: 512px; background-image: url('data:image/png;base64,${bgBase64}'); background-size: 1024px 512px; position: relative; overflow: hidden; }
  .badge-metal-text { font-family: 'Anton', sans-serif; transform: skewX(-12deg); text-transform: uppercase; text-align: center; white-space: nowrap; background: linear-gradient(180deg, #FFFFFF 0%, #D0D0D0 50%, #A0A0A0 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; filter: drop-shadow(0px 8px 6px rgba(0, 0, 0, 0.9)); -webkit-text-stroke: 3px #111111; }
  .smooth-metal-text { font-family: 'Anton', sans-serif; text-transform: uppercase; text-align: center; white-space: nowrap; background: linear-gradient(180deg, #FFFFFF 0%, #D0D0D0 50%, #A0A0A0 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; -webkit-text-stroke: 1px #111111; filter: drop-shadow(0px 4px 4px rgba(0, 0, 0, 0.5)); }
  .white-text { font-family: 'Anton', sans-serif; text-transform: uppercase; text-align: center; white-space: nowrap; color: #FFFFFF; -webkit-text-stroke: 1px #000000; }
  .title-container { position: absolute; top: 270px; height: 152px; width: 1024px; left: 0px; display: flex; justify-content: center; align-items: center; }
  .title { font-size: 110px; letter-spacing: -1px; }
  .bottom-text-container { position: absolute; bottom: 0px; height: 90px; width: 1024px; left: 0px; display: flex; justify-content: center; align-items: center; }
  .bottom-text { font-size: 65px; letter-spacing: 2px; }
  .badge-container { position: absolute; top: 115px; width: 215px; height: 215px; display: flex; justify-content: center; align-items: center; }
  .badge-bg { position: absolute; top: 0; left: 0; width: 100%; height: 100%; background-image: url('data:image/png;base64,${clawsBase64}'); background-size: cover; background-repeat: no-repeat; background-position: center; z-index: 1; }
  .badge-left { left: 0px; }
  .badge-right { right: 0px; }
  .dose { position: relative; z-index: 10; font-size: 92px; letter-spacing: 1px; line-height: 1; top: 5px; }
</style>
</head>
<body>
  <div class="badge-container badge-left"><div class="badge-bg"></div><div class="badge-metal-text dose" id="dose1"></div></div>
  <div class="badge-container badge-right"><div class="badge-bg"></div><div class="badge-metal-text dose" id="dose2"></div></div>
  <div class="title-container"><div class="smooth-metal-text title" id="title"></div></div>
  <div class="bottom-text-container"><div class="white-text bottom-text">FOR RESEARCH USE ONLY</div></div>
</body>
</html>
`;

async function run() {
  const missingSlugs = ['ipamorelin-ip5', 'tirzepatide-tr50'];
  const { data: ap } = await supabase.from('products').select('slug, name, unit_size, unit_measure').in('slug', missingSlugs);
  
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1024, height: 512, deviceScaleFactor: 1 });
  await page.setContent(htmlTemplate, { waitUntil: 'domcontentloaded' });
  await page.evaluate(async () => { await document.fonts.ready; });

  for (const product of ap) {
    let doseText = product.unit_size && product.unit_measure ? product.unit_size + product.unit_measure.toUpperCase() : '';
    await page.evaluate((titleText, doseTextStr) => {
      const title = document.getElementById('title');
      const dose1 = document.getElementById('dose1');
      const dose2 = document.getElementById('dose2');
      const titleContainer = document.querySelector('.title-container');
      const container = document.querySelector('.badge-left');
      title.textContent = titleText; dose1.textContent = doseTextStr; dose2.textContent = doseTextStr;
      title.style.fontSize = '110px'; dose1.style.fontSize = '80px'; dose2.style.fontSize = '80px';
      let fontSize = 110; while (title.scrollWidth > titleContainer.clientWidth && fontSize > 30) { fontSize -= 2; title.style.fontSize = fontSize + 'px'; }
      let doseSize = 80; while (dose1.scrollWidth > (container.clientWidth - 10) && doseSize > 20) { doseSize -= 1; dose1.style.fontSize = doseSize + 'px'; dose2.style.fontSize = doseSize + 'px'; }
    }, product.name, doseText);
    
    const buffer = await page.screenshot({ type: 'png' });
    const slug = product.slug;
    const { error: uploadErr } = await supabase.storage.from('print-labels').upload('savage/' + slug + '.png', buffer, { contentType: 'image/png', upsert: true });
    if (uploadErr) console.error("Failed to upload " + slug + ":", uploadErr);
    else console.log("Uploaded " + slug + " to Supabase print-labels bucket.");
  }
  await browser.close();
}
run().catch(console.error);
