const sharp = require('sharp');
sharp('/Users/smarter.poker/Documents/pepnationlab/public/images/coa-button.png')
  .trim()
  .metadata()
  .then(meta => {
    console.log("Trimmed Size:", meta.width, "x", meta.height);
    console.log("Ratio:", (meta.width / meta.height).toFixed(2));
  });
