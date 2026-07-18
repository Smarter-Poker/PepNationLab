const sharp = require('sharp');
sharp('/Users/smarter.poker/Documents/pepnationlab/public/images/coa-button.png')
  .trim({ threshold: 100 })
  .metadata()
  .then(meta => {
    console.log("Trimmed (100):", meta.width, "x", meta.height);
  });
