import os
from PIL import Image, ImageDraw

base_img_path = "public/images/products/5-amino-1mq-5am.png"
logo_path = "public/images/logo-savage.jpg"

base = Image.open(base_img_path).convert("RGBA")
logo = Image.open(logo_path).convert("RGBA")

logo_size = 195
logo_resized = logo.resize((logo_size, logo_size))
mask = Image.new("L", logo_resized.size, 0)
draw = ImageDraw.Draw(mask)
draw.ellipse((0, 0, logo_size, logo_size), fill=255)
logo_resized.putalpha(mask)

x = base.width // 2 - logo_size // 2
y = 458
base.paste(logo_resized, (x, y), logo_resized)
bg = Image.new("RGB", base.size, (255, 255, 255))
bg.paste(base, mask=base.split()[3])
bg.save("test_out.jpg", quality=95)
