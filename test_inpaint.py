import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont
import os

img_path = "public/images/products/l-carnitine-blend.png"
os.system(f"git checkout 1d9c152b -- {img_path}")

# Load image with cv2
img = cv2.imread(img_path, cv2.IMREAD_UNCHANGED)
if img.shape[2] == 4:
    # Convert RGBA to BGR for inpainting
    img_bgr = cv2.cvtColor(img, cv2.COLOR_RGBA2BGR)
else:
    img_bgr = img

# 1. Create a mask of the logo. The logo is dark.
# We will focus on the region where the logo is located.
roi_y1 = 730
roi_y2 = 815
roi_x1 = 340
roi_x2 = 680

mask = np.zeros(img_bgr.shape[:2], dtype=np.uint8)
# Threshold: dark pixels in the ROI become 255 in the mask
for y in range(roi_y1, roi_y2):
    for x in range(roi_x1, roi_x2):
        b, g, r = img_bgr[y, x]
        if r < 180 and g < 180 and b < 180:
            mask[y, x] = 255

# Dilate the mask slightly to ensure we capture anti-aliased edges
kernel = np.ones((3,3), np.uint8)
mask = cv2.dilate(mask, kernel, iterations=1)

# 2. Extract the original logo pixels (with alpha for blending later)
# We need soft blending for the logo to avoid jagged edges.
logo_img = img[roi_y1:roi_y2, roi_x1:roi_x2].copy()
logo_mask = mask[roi_y1:roi_y2, roi_x1:roi_x2]

# Create a transparent RGBA image of JUST the logo
logo_rgba = np.zeros((roi_y2 - roi_y1, roi_x2 - roi_x1, 4), dtype=np.uint8)
for y in range(logo_mask.shape[0]):
    for x in range(logo_mask.shape[1]):
        if logo_mask[y, x] > 0:
            if img.shape[2] == 4:
                b, g, r, a = logo_img[y, x]
                logo_rgba[y, x] = [b, g, r, a]
            else:
                b, g, r = logo_img[y, x]
                logo_rgba[y, x] = [b, g, r, 255]

# 3. Inpaint the original image to remove the logo
inpainted_bgr = cv2.inpaint(img_bgr, mask, 3, cv2.INPAINT_TELEA)

if img.shape[2] == 4:
    inpainted = cv2.cvtColor(inpainted_bgr, cv2.COLOR_BGR2RGBA)
    # Restore original alpha
    inpainted[:, :, 3] = img[:, :, 3]
else:
    inpainted = inpainted_bgr

# Convert to PIL for easy text drawing and alpha compositing
pil_img = Image.fromarray(cv2.cvtColor(inpainted, cv2.COLOR_BGRA2RGBA) if img.shape[2] == 4 else cv2.cvtColor(inpainted, cv2.COLOR_BGR2RGB))
if pil_img.mode != "RGBA":
    pil_img = pil_img.convert("RGBA")

pil_logo = Image.fromarray(cv2.cvtColor(logo_rgba, cv2.COLOR_BGRA2RGBA))

# Shift logo up by 25 pixels
shift_up = 25
pil_img.paste(pil_logo, (roi_x1, roi_y1 - shift_up), pil_logo)

# Draw larger text below it
draw = ImageDraw.Draw(pil_img)
font_path = "/System/Library/Fonts/Supplemental/Arial Narrow Bold.ttf"
font = ImageFont.truetype(font_path, 18) # Larger font!
text = "For Research Use Only"
bbox = draw.textbbox((0, 0), text, font=font)
text_w = bbox[2] - bbox[0]
text_h = bbox[3] - bbox[1]

# The original logo ended around y=812 (for the shield).
# We shifted it up by 25 pixels, so it now ends around 787.
# The red band starts around 815. 
# We have a gap from 787 to 815 = 28 pixels!
# Place text perfectly in this new gap.
text_y = 787 + (28 // 2)

draw.text((512 - text_w // 2, text_y - text_h // 2), text, fill=(0,0,0,255), font=font)

pil_img.convert("RGB").save("/Users/smarter.poker/.gemini/antigravity/brain/d42895c7-f522-47b1-87f7-86eaa6f77a14/preview_images/l-carnitine-blend_shifted.png")
print("Done inpainting test")
