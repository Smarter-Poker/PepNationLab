from PIL import Image, ImageDraw, ImageFont
import os

img_path = "public/images/products/l-carnitine-blend.png"
os.system(f"git checkout 1d9c152b -- {img_path}")

img = Image.open(img_path).convert("RGBA")

# The logo is roughly between y=735 and y=815
# Let's just crop a rectangle that spans the ENTIRE width of the white label!
# Left: 345, Right: 678 (from previous script)
# Let's just take x=330 to x=690 to be safe.
box = (330, 735, 690, 815)
logo_strip = img.crop(box)

# Now, we need to create our clean canvas from y=715
pixels = img.load()
clean_row = []
for x in range(330, 690):
    clean_row.append(pixels[x, 715])

# Fill the entire area from 715 to 815 with the clean row
for y in range(715, 815):
    for x in range(330, 690):
        pixels[x, y] = clean_row[x - 330]

# Now paste the logo strip back, but 25 pixels HIGHER!
# Original was y=735, so new y is 710.
img.paste(logo_strip, (330, 710))

# Draw the text at the bottom!
# Now the logo ends at 815 - 25 = 790.
# The band starts at 815. Space is 790 to 815 = 25px.
draw = ImageDraw.Draw(img)
font_path = "/System/Library/Fonts/Supplemental/Arial Narrow Bold.ttf"
font = ImageFont.truetype(font_path, 16) # Larger font!
text = "For Research Use Only"
bbox = draw.textbbox((0, 0), text, font=font)
text_w = bbox[2] - bbox[0]
text_h = bbox[3] - bbox[1]

text_y = 801
draw.text((512 - text_w // 2, text_y - text_h // 2), text, fill=(0,0,0,255), font=font)

img.convert("RGB").save("/Users/smarter.poker/.gemini/antigravity/brain/d42895c7-f522-47b1-87f7-86eaa6f77a14/preview_images/l-carnitine-blend_simple_shift.png")
print("Done")
