const fs = require('fs');
const { createCanvas, loadImage } = require('canvas');

async function extract() {
  const img = await loadImage('template.png');
  const width = img.width;
  const height = img.height;
  
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, width, height);
  
  const tempCanvas = createCanvas(width, height);
  const tempCtx = tempCanvas.getContext('2d');
  tempCtx.drawImage(img, 0, 0);
  const data = tempCtx.getImageData(0, 0, width, height).data;
  const newImgData = ctx.getImageData(0, 0, width, height);
  const newData = newImgData.data;
  
  // We want to KEEP the Savage Brands logo.
  // The logo is in the top-center. It's white/grey.
  // Let's keep everything where y < 180 AND x between 250 and 770.
  // (Assuming logo is bounded there and no other text is in this box).
  
  // We want to KEEP the cyan claws.
  // Cyan is where G>100, B>100, G-R>30, B-R>30.
  
  // We want to KEEP the bottom cyan banner.
  // Banner is at y > height - 60.
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const r = data[i];
      const g = data[i+1];
      const b = data[i+2];
      
      let keep = false;
      
      // Logo box
      if (y < 160 && x > 250 && x < 774) {
        keep = true;
      }
      
      // Cyan claws
      if (!keep && g > 100 && b > 100 && g - r > 30 && b - r > 30) {
        keep = true;
      }
      
      // Bottom banner
      if (!keep && y > height - 60) {
        keep = true;
      }
      
      if (keep) {
        newData[i] = r;
        newData[i+1] = g;
        newData[i+2] = b;
        newData[i+3] = 255;
      }
    }
  }
  
  ctx.putImageData(newImgData, 0, 0);
  
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync('perfect_blank.png', buffer);
  console.log('Saved perfect_blank.png');
}

extract().catch(console.error);
