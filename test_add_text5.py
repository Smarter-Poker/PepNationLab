import cv2
from PIL import Image, ImageDraw, ImageFont
import os

images = [
    ('l-carnitine-blend.png', 'single'),
    ('cagrilintide-sema.png', 'double'),
    ('glow-blend.png', 'single'),
    ('lemon-bottle.png', 'single'),
    ('wolverine-stack.png', 'double'),
    ('cjc-1295-ipa.png', 'single')
]

src_dir = '/Users/smarter.poker/Documents/pepnationlab/public/images/products'
os.system(f"git checkout -- {src_dir}")

preview_dir = os.path.join(src_dir, 'preview')
os.makedirs(preview_dir, exist_ok=True)

try:
    font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 16)
except:
    try:
        font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Bold.ttf", 16)
    except:
        font = ImageFont.load_default()

text = "For Research Use Only"

def draw_centered_text(draw, text, font, x, y):
    bbox = draw.textbbox((0, 0), text, font=font)
    w = bbox[2] - bbox[0]
    h = bbox[3] - bbox[1]
    draw.text((x - w/2, y - h/2), text, font=font, fill=(50, 50, 50, 255))

for filename, type_ in images:
    path = os.path.join(src_dir, filename)
    if not os.path.exists(path):
        continue
        
    img = Image.open(path).convert('RGBA')
    draw = ImageDraw.Draw(img)
    
    if type_ == 'single':
        draw_centered_text(draw, text, font, 512, 725)
    else:
        draw_centered_text(draw, text, font, 330, 715)
        draw_centered_text(draw, text, font, 694, 715)
        
    out_path = os.path.join(preview_dir, filename)
    img.save(out_path)
