from PIL import Image, ImageDraw, ImageFont
import os

img_path = "public/images/products/l-carnitine-blend.png"
os.system(f"git checkout 1d9c152b -- {img_path}")

img = Image.open(img_path).convert("RGBA")
pixels = img.load()

# TIGHT bounding box of just the logo
box_x1, box_y1 = 340, 755
box_x2, box_y2 = 665, 815

logo_box = img.crop((box_x1, box_y1, box_x2, box_y2))

# Overwrite the original logo area with a stretched clean row
clean_row = []
for x in range(box_x1, box_x2):
    clean_row.append(pixels[x, box_y1 - 5])

for y in range(box_y1, box_y2):
    for x in range(box_x1, box_x2):
        pixels[x, y] = clean_row[x - box_x1]

# Paste the logo shifted UP by 18 pixels
shift_up = 20
img.paste(logo_box, (box_x1, box_y1 - shift_up))

# Draw larger text
draw = ImageDraw.Draw(img)
font_path = "/System/Library/Fonts/Supplemental/Arial Narrow Bold.ttf"
font = ImageFont.truetype(font_path, 16) # Size 16 is much larger than 11-13!
text = "For Research Use Only"
bbox = draw.textbbox((0, 0), text, font=font)
text_w = bbox[2] - bbox[0]
text_h = bbox[3] - bbox[1]

# Logo originally ended at 815. It moved to 795. 
# The gap is 795 to 815.
text_y = 795 + (20 // 2) + 2

draw.text((512 - text_w // 2, text_y - text_h // 2), text, fill=(0,0,0,255), font=font)

img.convert("RGB").save("/Users/smarter.poker/.gemini/antigravity/brain/d42895c7-f522-47b1-87f7-86eaa6f77a14/preview_images/l-carnitine-blend_tight_crop.png")
print("Done")
