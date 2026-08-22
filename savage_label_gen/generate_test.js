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
    /* Vertically center between logo and teal bar */
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

  /* We must un-flip the text inside the right badge */
  .badge-right .dose {
    transform: scaleX(-1);
  }

  .dose {
    font-family: 'Teko', sans-serif;
    font-weight: 700;
    font-size: 125px; /* slightly larger */
    letter-spacing: 2px;
    /* Remove text stroke to prevent weird line */
    -webkit-text-stroke: 1px #111111; 
  }
</style>
</head>
<body>
  <div class="badge-container badge-left">
    <div class="metal-text dose" id="dose1">15MG</div>
  </div>
  
  <div class="title-container">
    <div class="metal-text title" id="title">RETATRUTIDE</div>
  </div>

  <div class="badge-container badge-right">
    <div class="metal-text dose" id="dose2">15MG</div>
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
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  await page.setViewport({ width: 1024, height: 512, deviceScaleFactor: 1 });

  await page.setContent(htmlTemplate, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#ready', { timeout: 10000 });
  
  const buffer = await page.screenshot({ type: 'png' });
  const destPath = require('path').join('/Users/smarter.poker/.gemini/antigravity/brain/5704cc86-3c79-46da-8052-0defc4900d3b/scratch', 'test_label_retatrutide_15mg.png');
  require('fs').writeFileSync(destPath, buffer);
  
  console.log(`Saved locally to ${destPath}`);
  await browser.close();
}

run().catch(console.error);
