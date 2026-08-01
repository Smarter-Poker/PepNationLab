const fs = require('fs');
const { createCanvas, loadImage } = require('canvas');

async function extract() {
  const img = await loadImage('template.png');
  const width = img.width;
  const height = img.height;
  
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  
  // Draw original
  ctx.drawImage(img, 0, 0);
  
  // Try to hide the original text with black boxes
  ctx.fillStyle = '#000000';
  
  // Hide left dose (guess width 200, height 200)
  ctx.fillRect(0, 0, 220, 250);
  
  // Hide right dose
  ctx.fillRect(width - 220, 0, 220, 250);
  
  // Hide title (bottom half, leaving the bottom cyan banner if any)
  // Let's assume title starts around y=250.
  ctx.fillRect(0, 250, width, height - 250);
  
  // Restore cyan banner at the bottom
  // Sample bottom left pixel
  const tempCtx = createCanvas(width, height).getContext('2d');
  tempCtx.drawImage(img, 0, 0);
  const data = tempCtx.getImageData(5, height - 5, 1, 1).data;
  ctx.fillStyle = `rgb(${data[0]},${data[1]},${data[2]})`;
  ctx.fillRect(0, height - 50, width, 50); // assume banner is 50px tall
  
  const buffer = canvas.toBuffer('image/png');
  fs.writeFileSync('test_blank.png', buffer);
  console.log('Saved test_blank.png');
}

extract().catch(console.error);
