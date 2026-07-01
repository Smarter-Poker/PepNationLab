from PIL import Image, ImageDraw, ImageFont
import os

img_path = "public/images/products/l-carnitine-blend.png"
os.system(f"git checkout 1d9c152b -- {img_path}")

img = Image.open(img_path).convert("RGBA")
pixels = img.load()

# 1. Identify the bounding box of the logo by scanning for dark pixels
# The logo is between y=730 and y=810, and x=300 to x=700
min_x, max_x = 999, 0
min_y, max_y = 999, 0

for y in range(730, 810):
    for x in range(300, 700):
        r, g, b = pixels[x, y][:3]
        if r < 180 and g < 180 and b < 180: # Found part of logo
            if x < min_x: min_x = x
            if x > max_x: max_x = x
            if y < min_y: min_y = y
            if y > max_y: max_y = y

# Add a tiny bit of padding
min_x -= 5
max_x += 5
min_y -= 5
max_y += 5

print(f"Precise logo bounds: x={min_x} to {max_x}, y={min_y} to {max_y}")

# 2. Extract this precise box
logo_box = img.crop((min_x, min_y, max_x, max_y))

# 3. Create a clean background to overwrite the old logo
# We take a single pixel row from right above the logo (min_y - 2)
# and stretch it down to cover the old logo area.
clean_row = []
for x in range(min_x, max_x):
    clean_row.append(pixels[x, min_y - 2])

for y in range(min_y, max_y):
    for x in range(min_x, max_x):
        pixels[x, y] = clean_row[x - min_x]

# 4. Paste the logo shifted UP by 25 pixels!
shift_up = 25
img.paste(logo_box, (min_x, min_y - shift_up))

# 5. Draw the larger text in the new gap!
draw = ImageDraw.Draw(img)
font_path = "/System/Library/Fonts/Supplemental/Arial Narrow Bold.ttf"
font = ImageFont.truetype(font_path, 18)
text = "For Research Use Only"
bbox = draw.textbbox((0, 0), text, font=font)
text_w = bbox[2] - bbox[0]
text_h = bbox[3] - bbox[1]

# New gap is from (max_y - shift_up) to 815
new_logo_end = max_y - shift_up
text_y = new_logo_end + ((815 - new_logo_end) // 2)

draw.text((512 - text_w // 2, text_y - text_h // 2), text, fill=(0,0,0,255), font=font)

img.convert("RGB").save("/Users/smarter.poker/.gemini/antigravity/brain/d42895c7-f522-47b1-87f7-86eaa6f77a14/preview_images/l-carnitine-blend_precise_shift.png")
print("Done")
