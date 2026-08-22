const fs = require('fs');
const { createCanvas, loadImage } = require('canvas');

async function extract() {
  const img = await loadImage('template.png');
  const width = img.width;
  const height = img.height;
  
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  
  // Draw black background
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, width, height);
  
  // Draw original image on another canvas to read pixel data
  const tempCanvas = createCanvas(width, height);
  const tempCtx = tempCanvas.getContext('2d');
  tempCtx.drawImage(img, 0, 0);
  const imgData = tempCtx.getImageData(0, 0, width, height);
  const data = imgData.data;
  
  const newImgData = ctx.getImageData(0, 0, width, height);
  const newData = newImgData.data;
  
  // 1. Copy the top 45% center 60% for the logo
  const logoYEnd = Math.floor(height * 0.45);
  const logoXStart = Math.floor(width * 0.20);
  const logoXEnd = Math.floor(width * 0.80);
  
  // We'll also just scan the whole image and keep cyan pixels.
  // Cyan is R low, G high, B high.
  // Let's say R < 120, G > 100, B > 100, G-R > 50, B-R > 50
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const r = data[i];
      const g = data[i+1];
      const b = data[i+2];
      const a = data[i+3];
      
      let keep = false;
      
      // Is it logo?
      if (y < logoYEnd && x > logoXStart && x < logoXEnd) {
        keep = true;
      }
      
      // Is it cyan?
      if (!keep) {
        if (g > 100 && b > 100 && g - r > 40 && b - r > 40) {
          keep = true;
        }
      }
      
      if (keep) {
        newData[i] = r;
        newData[i+1] = g;
        newData[i+2] = b;
        newData[i+3] = a;
      }
    }
  }
  
  ctx.putImageData(newImgData, 0, 0);
  
  // The bottom banner is cyan: #00D5F2 or similar. 
  // Let's just sample it from the bottom left
  const bottomI = ((height - 5) * width + 5) * 4;
  const br = data[bottomI];
  const bg = data[bottomI+1];
  const bb = data[bottomI+2];
  
  const bannerH = Math.floor(height * 0.18);
  ctx.fillStyle = `rgb(${br},${bg},${bb})`;
  ctx.fillRect(0, height - bannerH, width, bannerH);
  
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync('savage-blank-template.png', buffer);
  console.log('Saved savage-blank-template.png');
}

extract().catch(console.error);
