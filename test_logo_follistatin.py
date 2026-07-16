import os
from PIL import Image, ImageDraw

# Now let's try with follistatin base image
base_img_path = "public/images/products/follistatin-fn1.png"
logo_path = "public/images/logo-savage.jpg"

base = Image.open(base_img_path).convert("RGBA")
logo = Image.open(logo_path).convert("RGBA")

logo_size = 175
logo_resized = logo.resize((logo_size, logo_size))

# Circular mask
mask = Image.new("L", logo_resized.size, 0)
draw = ImageDraw.Draw(mask)
draw.ellipse((0, 0, logo_size, logo_size), fill=255)
logo_resized.putalpha(mask)

x = base.width // 2 - logo_size // 2
y = 385 

base.paste(logo_resized, (x, y), logo_resized)
out_dir = "/Users/smarter.poker/.gemini/antigravity/brain/b26182bb-4d5c-42b7-9fd2-cc939d229926/scratch"
base.convert("RGB").save(f"{out_dir}/test_follistatin.jpg", quality=95)
print("Saved to scratch/test_follistatin.jpg")
