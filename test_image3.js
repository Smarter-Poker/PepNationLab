const sharp = require('sharp');
sharp('/Users/smarter.poker/Documents/pepnationlab/public/images/add-to-cart-dynamic.png')
  .trim()
  .metadata()
  .then(meta => {
    console.log("Add To Cart Trimmed Size:", meta.width, "x", meta.height);
    console.log("Ratio:", (meta.width / meta.height).toFixed(2));
  });
