const puppeteer = require('puppeteer');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function getCategoryColor(categoryName) {
  const normalized = categoryName?.toLowerCase() || '';
  if (normalized.includes('weight loss')) return '#FF0000';
  if (normalized.includes('healing') || normalized.includes('recovery')) return '#008080';
  if (normalized.includes('growth hormone')) return '#FFD700';
  if (normalized.includes('muscle')) return '#4169E1';
  if (normalized.includes('sexual')) return '#800080';
  if (normalized.includes('anti-aging')) return '#B76E79';
  if (normalized.includes('skin') || normalized.includes('hair')) return '#50C878';
  if (normalized.includes('nootropic')) return '#C0C0C0';
  if (normalized.includes('stack')) return '#FFFFFF';
  return '#00d2ff'; // default teal
}

(async () => {
  const { data: products, error } = await supabase.from('products').select('id, name, slug, category').eq('is_banned', false);
  if (error) {
    console.error('Error fetching products:', error);
    process.exit(1);
  }

  console.log(`Found ${products.length} products`);

  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width: 788, height: 300, deviceScaleFactor: 1 });
  const logoPath = `file://${__dirname}/public/images/logo-savage.jpg`;

  for (const p of products) {
    const cleanName = p.name.replace(/\s*\(.*?\)\s*/g, '').trim();
    const subtitleMatch = p.name.match(/\((.*?)\)/);
    const subtitle = subtitleMatch ? subtitleMatch[1] : '';
    const doseMatch = subtitle.match(/(\d+(?:\.\d+)?(?:mg|mcg|IU|ml))/i);
    const doseString = doseMatch ? doseMatch[1].toLowerCase() : '';

    const accentColor = getCategoryColor(p.category);

    const nameFontSize = cleanName.length > 8 ? '85px' : '110px';

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
    <style>
      body { margin: 0; padding: 0; background: #050505; }
    </style>
    </head>
    <body>
      <div style="width: 788px; height: 300px; transform: scale(1); transform-origin: top left; background-color: #050505; font-family: 'Arial Black', Impact, 'Helvetica Neue', sans-serif; display: flex; position: relative; overflow: hidden; border-top: 12px solid ${accentColor}; border-bottom: 12px solid ${accentColor}; box-sizing: border-box;">
        
        <div style="width: 330px; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 20px;">
          <img src="${logoPath}" style="width: 100%; height: 100%; object-fit: contain; mix-blend-mode: screen;" alt="logo" />
        </div>

        <div style="flex: 1; height: 100%; display: flex; flex-direction: column; padding-top: 30px;">
          
          <div style="padding-right: 30px; display: flex; flex-direction: column; align-items: flex-start;">
            <div style="width: 100%; height: 4px; background: linear-gradient(to right, #ffffff 0%, #a0a0a0 50%, #ffffff 100%); margin-bottom: 8px; box-shadow: 0 1px 2px rgba(0,0,0,0.8);"></div>

            <div style="font-size: ${nameFontSize}; font-weight: 900; line-height: 1.1; text-transform: uppercase; color: #ffffff; text-shadow: 2px 4px 6px rgba(0,0,0,0.9); letter-spacing: -1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
              ${cleanName}
            </div>
          </div>

          <div style="width: 100%; background-color: ${accentColor}; padding: 12px 0; display: flex; align-items: center; justify-content: center; margin-left: -10px; margin-top: auto; margin-bottom: 20px;">
            <div style="color: #000000; font-size: 32px; font-family: 'Helvetica Neue', Arial, sans-serif; display: flex; align-items: center; gap: 8px;">
              ${doseString ? `<span style="font-weight: 900;">${doseString}</span><span style="font-weight: 500;">-</span>` : ''}
              <span style="font-weight: 500;">Research Compound</span>
            </div>
          </div>

        </div>
      </div>
    </body>
    </html>
    `;

    await page.setContent(html);
    // Wait for image to load
    await new Promise(r => setTimeout(r, 50));

    const outPath = `${__dirname}/public/images/savage-brands-flattened/${p.slug}.png`;
    await page.screenshot({ path: outPath });
    console.log(`Generated ${outPath}`);
  }

  await browser.close();
})();
