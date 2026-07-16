import os
from PIL import Image, ImageDraw

base_img_path = "public/images/products/aod9604-10ad.png"
logo_path = "public/images/logo-savage.jpg"

base = Image.open(base_img_path).convert("RGBA")
logo = Image.open(logo_path).convert("RGBA")

# Draw teal box to cover old logo and text
draw = ImageDraw.Draw(base)
# The teal background is around (32, 110, 112). 
# Wait, let's sample the color from an empty spot on the label
teal_color = base.getpixel((150, 450)) 
draw.rectangle([180, 400, 420, 580], fill=teal_color)

logo_size = 150
logo_resized = logo.resize((logo_size, logo_size))

# Circular mask
mask = Image.new("L", logo_resized.size, 0)
draw_mask = ImageDraw.Draw(mask)
draw_mask.ellipse((0, 0, logo_size, logo_size), fill=255)
logo_resized.putalpha(mask)

x = base.width // 2 - logo_size // 2
y = 410

base.paste(logo_resized, (x, y), logo_resized)
out_dir = "/Users/smarter.poker/.gemini/antigravity/brain/b26182bb-4d5c-42b7-9fd2-cc939d229926/scratch"
base.convert("RGB").save(f"{out_dir}/test_aod2.jpg", quality=95)
print("Saved to scratch/test_aod2.jpg")
