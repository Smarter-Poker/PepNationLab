import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont
import os

def draw_curved_text(text, font_path, font_size, curve_amount, text_color=(0, 0, 0, 255)):
    font = ImageFont.truetype(font_path, font_size)
    dummy_img = Image.new('RGBA', (1, 1))
    draw = ImageDraw.Draw(dummy_img)
    bbox = draw.textbbox((0, 0), text, font=font)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]
    
    img_w = text_w + 20
    img_h = text_h + int(curve_amount) + 20
    
    text_img = Image.new('RGBA', (img_w, img_h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(text_img)
    draw.text((10, 10 - bbox[1]), text, fill=text_color, font=font)
    
    arr = np.array(text_img)
    curved_arr = np.zeros_like(arr)
    
    center_x = img_w / 2
    k = curve_amount / (center_x ** 2) if center_x > 0 else 0
    
    for x in range(img_w):
        dy = int(k * (x - center_x) ** 2)
        if dy < img_h:
            curved_arr[dy:img_h, x] = arr[0:img_h-dy, x]
            
    return Image.fromarray(curved_arr)

# Restore the 6 clean images from the original commit before any edits
os.system("git checkout 1d9c152b -- public/images/products/l-carnitine-blend.png public/images/products/cagrilintide-sema.png public/images/products/glow-blend.png public/images/products/lemon-bottle.png public/images/products/wolverine-stack.png public/images/products/cjc-1295-ipa.png")

configs = {
    'l-carnitine-blend.png': [
        {'x': 512, 'y': 827, 'curve': 5, 'size': 20}
    ],
    'cjc-1295-ipa.png': [
        {'x': 512, 'y': 825, 'curve': 5, 'size': 20}
    ],
    'lemon-bottle.png': [
        {'x': 512, 'y': 795, 'curve': 5, 'size': 20}
    ],
    'cagrilintide-sema.png': [
        {'x': 310, 'y': 825, 'curve': 3, 'size': 18},
        {'x': 714, 'y': 815, 'curve': 3, 'size': 18}
    ],
    'wolverine-stack.png': [
        {'x': 310, 'y': 815, 'curve': 3, 'size': 18},
        {'x': 714, 'y': 820, 'curve': 3, 'size': 18}
    ]
}

src_dir = "public/images/products"
preview_dir = "/Users/smarter.poker/.gemini/antigravity/brain/d42895c7-f522-47b1-87f7-86eaa6f77a14/preview_images"
os.system(f"mkdir -p {preview_dir}")

text = "For Research Use Only"
font_path = "/System/Library/Fonts/Supplemental/Arial Narrow Bold.ttf"
if not os.path.exists(font_path):
    font_path = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"

for filename, placements in configs.items():
    src_path = os.path.join(src_dir, filename)
    preview_path = os.path.join(preview_dir, filename)
    
    img = Image.open(src_path).convert("RGBA")
    
    for p in placements:
        curved_img = draw_curved_text(text, font_path, p['size'], p['curve'])
        img.paste(curved_img, (p['x'] - curved_img.width // 2, p['y'] - curved_img.height // 2), curved_img)
        
    img.convert("RGB").save(preview_path)

# Handle glow-blend specially since it has no bottom band and needs white space erased
src_path = os.path.join(src_dir, 'glow-blend.png')
preview_path = os.path.join(preview_dir, 'glow-blend.png')
img = Image.open(src_path).convert("RGBA")
draw = ImageDraw.Draw(img)
# Draw white box to erase original bottom text on the white label
draw.rectangle([340, 775, 680, 805], fill=(235, 236, 235, 255))
curved_img = draw_curved_text("Store at 2-8°C | For Research Use Only", font_path, 16, 3, text_color=(0,0,0,255))
img.paste(curved_img, (512 - curved_img.width // 2, 790 - curved_img.height // 2), curved_img)
img.convert("RGB").save(preview_path)

print("Done")
