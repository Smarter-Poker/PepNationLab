const sharp = require('sharp');
sharp('/Users/smarter.poker/.gemini/antigravity/brain/36b8d1d7-0e6d-4948-90a7-33f2114fbcf5/.user_uploaded/media__1784384384324.png')
  .metadata()
  .then(meta => {
    console.log("Uploaded Image Size:", meta.width, "x", meta.height);
    console.log("Ratio:", (meta.width / meta.height).toFixed(2));
  });
