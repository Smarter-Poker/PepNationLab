const sharp = require('sharp');
sharp('/Users/smarter.poker/Documents/pepnationlab/public/images/coa-button.png')
  .trim({ threshold: 50, background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .metadata()
  .then(meta => {
    console.log("Trimmed Rembg Size:", meta.width, "x", meta.height);
  });
