const sharp = require('sharp');

// Find the bounding box of non-transparent pixels with a higher threshold to ignore faint shadows
sharp('/Users/smarter.poker/Documents/pepnationlab/public/images/coa-button.png')
  .trim({ threshold: 50 }) // higher threshold
  .metadata()
  .then(meta => {
    console.log("Trimmed (Threshold 50):", meta.width, "x", meta.height);
  });
