const puppeteer = require('puppeteer');
const fs = require('fs');

const textureBuffer = fs.readFileSync('texture.png');
const textureBase64 = textureBuffer.toString('base64');

const clawsBuffer = fs.readFileSync('middle_claws.png');
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
    width: 280px;
    height: 280px;
    background: transparent;
    overflow: hidden;
  }
  
  .badge-container {
    position: relative;
    width: 280px;
    height: 280px;
    display: flex;
    justify-content: center;
    align-items: center;
  }

  .claws-bg {
    position: absolute;
    width: 80%;
    height: 80%;
    background-image: url('data:image/png;base64,${clawsBase64}');
    background-size: contain;
    background-repeat: no-repeat;
    background-position: center;
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
    
    background-image: url('data:image/png;base64,${textureBase64}');
    background-repeat: repeat;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    
    /* Simulate a thick black stroke using drop shadows for better rendering */
    filter: 
      drop-shadow(2px 0px 0px #000)
      drop-shadow(-2px 0px 0px #000)
      drop-shadow(0px 2px 0px #000)
      drop-shadow(0px -2px 0px #000)
      drop-shadow(0px 8px 6px rgba(0, 0, 0, 0.9));
  }

  /* fallback standard stroke */
  @supports (-webkit-text-stroke: 3px black) {
    .metal-text {
      -webkit-text-stroke: 3px black;
      filter: drop-shadow(0px 8px 6px rgba(0, 0, 0, 0.9));
    }
  }

  .dose {
    font-size: 130px;
    letter-spacing: -2px;
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
      
      let doseSize = 130;
      while (dose.scrollWidth > (container.clientWidth - 20) && doseSize > 30) {
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
  await page.setViewport({ width: 280, height: 280, deviceScaleFactor: 1 });

  const doses = ['5MG', '10MG', '15MG'];

  for (const doseText of doses) {
    const html = htmlTemplate.replace(/DOSE_TEXT/g, doseText);
    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#ready', { timeout: 10000 });
    
    const buffer = await page.screenshot({ type: 'png', omitBackground: true });
    fs.writeFileSync(`new_badge_${doseText}.png`, buffer);
    console.log(`Saved new_badge_${doseText}.png`);
  }

  await browser.close();
}

run().catch(console.error);
