from PIL import Image, ImageDraw, ImageFont
import os

img_path = "public/images/products/l-carnitine-blend.png"
os.system(f"git checkout 1d9c152b -- {img_path}")

img = Image.open(img_path).convert("RGBA")
pixels = img.load()

# Find the start of the colored band at the center (x=512)
band_start = None
for y in range(850, 750, -1):
    r, g, b = pixels[512, y][:3]
    if r > 210 and g > 210 and b > 210:
        band_start = y + 1
        break

print(f"Band starts at {band_start}")

# We want to stretch the white label down by 15 pixels.
# The white label ends at band_start - 1.
# But we must only stretch the white label width! 
# Let's find the left and right bounds of the white label at band_start - 5
left_x = 512
while True:
    r, g, b = pixels[left_x, band_start - 5][:3]
    if r < 100 and g < 100 and b < 100: # hit the black shadow/edge
        break
    left_x -= 1
    
right_x = 512
while True:
    r, g, b = pixels[right_x, band_start - 5][:3]
    if r < 100 and g < 100 and b < 100:
        break
    right_x += 1

print(f"Label bounds at bottom: {left_x} to {right_x}")

# Extract a clean white row from band_start - 2
clean_row = []
for x in range(left_x + 3, right_x - 3): # Add padding to not stretch the black edge over the red curve
    clean_row.append(pixels[x, band_start - 2])

# Overwrite the top 15 pixels of the band!
stretch_amount = 16
for y in range(band_start, band_start + stretch_amount):
    for x in range(left_x + 3, right_x - 3):
        pixels[x, y] = clean_row[x - (left_x + 3)]

# Now we have 16 more pixels of white space!
# We can draw LARGER text in the middle of this new combined gap!
draw = ImageDraw.Draw(img)
font_path = "/System/Library/Fonts/Supplemental/Arial Narrow Bold.ttf"
font = ImageFont.truetype(font_path, 16) # Size 16!
text = "For Research Use Only"
bbox = draw.textbbox((0, 0), text, font=font)
text_w = bbox[2] - bbox[0]
text_h = bbox[3] - bbox[1]

# New gap is between the logo and the NEW band start (band_start + stretch_amount)
# Let's just put it 2 pixels above the new band_start
text_y = band_start + stretch_amount - 2

draw.text((512 - text_w // 2, text_y - text_h // 2), text, fill=(0,0,0,255), font=font)

img.convert("RGB").save("/Users/smarter.poker/.gemini/antigravity/brain/d42895c7-f522-47b1-87f7-86eaa6f77a14/preview_images/l-carnitine-blend_stretch_down.png")
print("Done")
