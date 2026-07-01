from PIL import Image, ImageDraw, ImageFont
import os

img_path = "public/images/products/l-carnitine-blend.png"
os.system(f"git checkout 1d9c152b -- {img_path}")

img = Image.open(img_path).convert("RGBA")
pixels = img.load()

roi_y1 = 730
roi_y2 = 815
roi_x1 = 340
roi_x2 = 680
shift_up = 25

# 1. Identify logo pixels
logo_pixels = []
for y in range(roi_y1, roi_y2):
    for x in range(roi_x1, roi_x2):
        r, g, b = pixels[x, y][:3]
        if r < 180 and g < 180 and b < 180: # It's a dark pixel (part of logo)
            logo_pixels.append((x, y, pixels[x, y]))

# 2. Erase old logo by filling with background color
# The label is a gradient, but it's mostly vertical. We can sample the pixel 30 pixels above.
for x, y, _ in logo_pixels:
    # Sample the color from the background slightly above the logo
    bg_color = pixels[x, y - 35] 
    # If the sampled color is also dark, just use a default whiteish color
    if bg_color[0] < 180 and bg_color[1] < 180 and bg_color[2] < 180:
        bg_color = (215, 215, 215, 255)
    pixels[x, y] = bg_color

# 3. Draw logo at new position
# To avoid overwriting with anti-aliasing artifacts, we sort by y ascending
for x, y, color in logo_pixels:
    # Blend the logo pixel over the existing background
    new_y = y - shift_up
    bg = pixels[x, new_y]
    
    # Simple alpha blending manually? 
    # Since the logo pixels from original image are already anti-aliased with a white background,
    # pasting them onto a very similar white background should look fine!
    pixels[x, new_y] = color

# 4. Draw the larger text
draw = ImageDraw.Draw(img)
font_path = "/System/Library/Fonts/Supplemental/Arial Narrow Bold.ttf"
font = ImageFont.truetype(font_path, 18)
text = "For Research Use Only"
bbox = draw.textbbox((0, 0), text, font=font)
text_w = bbox[2] - bbox[0]
text_h = bbox[3] - bbox[1]

text_y = 787 + (28 // 2)
draw.text((512 - text_w // 2, text_y - text_h // 2), text, fill=(0,0,0,255), font=font)

img.convert("RGB").save("/Users/smarter.poker/.gemini/antigravity/brain/d42895c7-f522-47b1-87f7-86eaa6f77a14/preview_images/l-carnitine-blend_shift2.png")
print("Done")
