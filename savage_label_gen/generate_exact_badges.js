const puppeteer = require('puppeteer');
const fs = require('fs');

const clawsBuffer = fs.readFileSync('line_claws.png');
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
    width: 200px;
    height: 200px;
    background: transparent;
    overflow: hidden;
  }
  
  .badge-container {
    position: relative;
    width: 200px;
    height: 200px;
    display: flex;
    justify-content: center;
    align-items: center;
  }

  .claws-bg {
    position: absolute;
    width: 100%;
    height: 100%;
    background-image: url('data:image/png;base64,${clawsBase64}');
    background-size: cover;
    background-position: center;
    background-repeat: no-repeat;
    z-index: 1;
  }

  .metal-text {
    position: relative;
    z-index: 10;
    font-family: 'Anton', sans-serif;
    transform: skewX(-15deg);
    text-transform: uppercase;
    text-align: center;
    white-space: nowrap;
    
    color: #FFFFFF;
    -webkit-text-stroke: 3px #000000;
    
    /* Simulate a thick black shadow for the grungy outline */
    filter: 
      drop-shadow(2px 0px 0px #000)
      drop-shadow(-2px 0px 0px #000)
      drop-shadow(0px 2px 0px #000)
      drop-shadow(0px -2px 0px #000)
      drop-shadow(2px 2px 4px rgba(0, 0, 0, 0.9));
  }

  .dose {
    font-size: 80px;
    letter-spacing: 1px;
    line-height: 1;
  }
</style>
</head>
<body>
  <div class="badge-container">
    <div class="claws-bg"></div>
    <div class="metal-text dose" id="dose">DOSE_TEXT</div>
  </div>

  <script>
    async function init() {
      await document.fonts.ready;
      const dose = document.getElementById('dose');
      const container = document.querySelector('.badge-container');
      
      let doseSize = 80;
      while (dose.scrollWidth > (container.clientWidth - 10) && doseSize > 20) {
        doseSize -= 1;
        dose.style.fontSize = doseSize + 'px';
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
  await page.setViewport({ width: 200, height: 200, deviceScaleFactor: 1 });

  const doses = ['5MG', '10MG', '15MG'];

  for (const doseText of doses) {
    const html = htmlTemplate.replace(/DOSE_TEXT/g, doseText);
    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#ready', { timeout: 10000 });
    
    const buffer = await page.screenshot({ type: 'png', omitBackground: true });
    fs.writeFileSync(`exact_badge_${doseText}.png`, buffer);
    console.log(`Saved exact_badge_${doseText}.png`);
  }

  await browser.close();
}

run().catch(console.error);
