const puppeteer = require('puppeteer');
const fs = require('fs');

const bgBuffer = fs.readFileSync('true_blank.png');
const bgBase64 = bgBuffer.toString('base64');

const leftClawsBuffer = fs.readFileSync('left_claws.png');
const leftClawsBase64 = leftClawsBuffer.toString('base64');

const rightClawsBuffer = fs.readFileSync('right_claws.png');
const rightClawsBase64 = rightClawsBuffer.toString('base64');

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
    left: 0px; 
    background-image: url('data:image/png;base64,${leftClawsBase64}');
    background-size: contain;
    background-repeat: no-repeat;
    background-position: center;
  }
  
  .badge-right { 
    right: 0px; 
    background-image: url('data:image/png;base64,${rightClawsBase64}');
    background-size: contain;
    background-repeat: no-repeat;
    background-position: center;
  }

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
      let doseSize = 110;
      // Subtract some padding to fit inside the badge nicely
      while (dose1.scrollWidth > (doseContainer.clientWidth - 40) && doseSize > 30) {
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

  // Test with 10MG as standard test
  const html = htmlTemplate
    .replace(/TITLE_TEXT/g, 'EPITHALON')
    .replace(/DOSE_TEXT/g, '10MG');

  await page.setContent(html, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#ready', { timeout: 10000 });
  const buffer = await page.screenshot({ type: 'png' });
  fs.writeFileSync('test_puppeteer_v2.png', buffer);
  
  // Test with a larger text like 100MG to see scaling
  const html2 = htmlTemplate
    .replace(/TITLE_TEXT/g, 'SOME LONG PEPTIDE NAME')
    .replace(/DOSE_TEXT/g, '100MG');

  await page.setContent(html2, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#ready', { timeout: 10000 });
  const buffer2 = await page.screenshot({ type: 'png' });
  fs.writeFileSync('test_puppeteer_v2_100mg.png', buffer2);

  await browser.close();
  console.log('Saved test_puppeteer_v2.png and test_puppeteer_v2_100mg.png');
}

run().catch(console.error);
