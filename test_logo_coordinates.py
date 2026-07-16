import os
from PIL import Image, ImageDraw

base_img_path = "public/images/products/aod9604-10ad.png"
logo_path = "public/images/logo-savage.jpg"

base = Image.open(base_img_path).convert("RGBA")
logo = Image.open(logo_path).convert("RGBA")

# Let's try placing the logo at Y=230, X=240, size=120
logo_size = 120
logo_resized = logo.resize((logo_size, logo_size))

# Circular mask
mask = Image.new("L", logo_resized.size, 0)
draw = ImageDraw.Draw(mask)
draw.ellipse((0, 0, logo_size, logo_size), fill=255)
logo_resized.putalpha(mask)

x = base.width // 2 - logo_size // 2
y = 225 # adjusted guess

base.paste(logo_resized, (x, y), logo_resized)
out_dir = "/Users/smarter.poker/.gemini/antigravity/brain/b26182bb-4d5c-42b7-9fd2-cc939d229926/scratch"
os.makedirs(out_dir, exist_ok=True)
base.convert("RGB").save(f"{out_dir}/test_aod.jpg", quality=95)
print("Saved to scratch/test_aod.jpg")
