const puppeteer = require('puppeteer');
const fs = require('fs');

const leftClawsBuffer = fs.readFileSync('left_claws.png');
const leftClawsBase64 = leftClawsBuffer.toString('base64');

const htmlTemplate = `
<!DOCTYPE html>
<html>
<head>
<link href="https://fonts.googleapis.com/css2?family=Anton&family=Teko:wght@700&display=swap" rel="stylesheet">
<style>
  body {
    margin: 0;
    padding: 0;
    width: 240px;
    height: 210px;
    background: transparent;
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

  .badge-container {
    width: 240px;
    height: 210px;
    display: flex;
    justify-content: center;
    align-items: center;
    background-image: url('data:image/png;base64,${leftClawsBase64}');
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
  <div class="badge-container">
    <div class="metal-text dose" id="dose">DOSE_TEXT</div>
  </div>

  <script>
    async function init() {
      await document.fonts.ready;
      const dose = document.getElementById('dose');
      const container = document.querySelector('.badge-container');
      
      let doseSize = 110;
      while (dose.scrollWidth > (container.clientWidth - 40) && doseSize > 30) {
        doseSize -= 2;
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
  await page.setViewport({ width: 240, height: 210, deviceScaleFactor: 1 });

  const doses = ['5MG', '10MG', '15MG'];

  for (const doseText of doses) {
    const html = htmlTemplate.replace(/DOSE_TEXT/g, doseText);
    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#ready', { timeout: 10000 });
    
    // Omit background so we get transparent background
    const buffer = await page.screenshot({ type: 'png', omitBackground: true });
    fs.writeFileSync(`badge_${doseText}.png`, buffer);
    console.log(`Saved badge_${doseText}.png`);
  }

  await browser.close();
}

run().catch(console.error);
