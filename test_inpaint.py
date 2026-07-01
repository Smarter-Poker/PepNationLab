import cv2
import numpy as np
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

def process_image(filename, type_):
    path = os.path.join(src_dir, filename)
    if not os.path.exists(path): return

    # Load with OpenCV for inpainting
    img_cv = cv2.imread(path)
    
    # Create mask for white text at bottom
    mask = np.zeros(img_cv.shape[:2], dtype=np.uint8)
    
    # Define ROI based on type
    if type_ == 'single':
        rois = [(770, 810, 400, 624)] # y1, y2, x1, x2
    else:
        rois = [(770, 810, 200, 450), (770, 810, 580, 820)]
        
    for y1, y2, x1, x2 in rois:
        roi = img_cv[y1:y2, x1:x2]
        # White text is usually > 200 in all channels
        white_mask = cv2.inRange(roi, np.array([180, 180, 180]), np.array([255, 255, 255]))
        mask[y1:y2, x1:x2] = white_mask

    # Dilate mask
    kernel = np.ones((3,3), np.uint8)
    mask = cv2.dilate(mask, kernel, iterations=2)

    # Inpaint
    inpainted = cv2.inpaint(img_cv, mask, 3, cv2.INPAINT_TELEA)

    # Convert to PIL
    inpainted_rgb = cv2.cvtColor(inpainted, cv2.COLOR_BGR2RGB)
    img_pil = Image.fromarray(inpainted_rgb).convert('RGBA')
    draw = ImageDraw.Draw(img_pil)
    
    def draw_centered_text(x, y):
        bbox = draw.textbbox((0, 0), text, font=font)
        w = bbox[2] - bbox[0]
        h = bbox[3] - bbox[1]
        draw.text((x - w/2, y - h/2), text, font=font, fill=(0, 0, 0, 255)) # BLACK

    if type_ == 'single':
        draw_centered_text(512, 790)
    else:
        draw_centered_text(330, 785)
        draw_centered_text(694, 785)

    img_pil.save(os.path.join(preview_dir, filename))

for f, t in images:
    process_image(f, t)
