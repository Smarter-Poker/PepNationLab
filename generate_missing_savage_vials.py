import os
from PIL import Image, ImageDraw

mapping = {
    'public/images/products/glow-tb10-bpc10-ghk50-bbg70.png': 'public/images/savage-brands/stack-glow-1vial.jpg',
    'public/images/products/survodutide-sur10.png': 'public/images/savage-brands/survodutide-10mg.jpg',
    'public/images/products/aod9604-10ad.png': 'public/images/savage-brands/aod9604-10mg.jpg',
    'public/images/products/mots-c-ms10.png': 'public/images/savage-brands/motsc-10mg.jpg',
    'public/images/products/hmg-g75.png': 'public/images/savage-brands/hmg-75iu.jpg',
    'public/images/products/follistatin-fn1.png': 'public/images/savage-brands/follistatin-1mg.jpg',
    'public/images/products/thymosin-alpha-1-ta10.png': 'public/images/savage-brands/thymosin-alpha1-10mg.jpg',
    'public/images/products/vip-vp10.png': 'public/images/savage-brands/vip-10mg.jpg',
    'public/images/products/semax-xa10.png': 'public/images/savage-brands/semax-10mg.jpg',
    'public/images/products/dsip-ds10.png': 'public/images/savage-brands/dsip-10mg.jpg',
}

logo_path = "public/images/logo-savage.jpg"
logo = Image.open(logo_path).convert("RGBA")

logo_size = 195
logo_resized = logo.resize((logo_size, logo_size))

mask = Image.new("L", logo_resized.size, 0)
draw = ImageDraw.Draw(mask)
draw.ellipse((0, 0, logo_size, logo_size), fill=255)
logo_resized.putalpha(mask)

for src, dst in mapping.items():
    if not os.path.exists(src):
        print(f"Skipping {src}, not found")
        continue
    
    base = Image.open(src).convert("RGBA")
    
    x = base.width // 2 - logo_size // 2
    y = 458
    
    base.paste(logo_resized, (x, y), logo_resized)
    
    bg = Image.new("RGB", base.size, (255, 255, 255))
    bg.paste(base, mask=base.split()[3])
    
    bg.save(dst, quality=95)
    print(f"Generated {dst}")
