import os
import re
from PIL import Image, ImageDraw

log_path = "/Users/smarter.poker/.gemini/antigravity/brain/c3476d7e-6278-4f79-aea8-9f09c98e66bc/.system_generated/tasks/task-52.log"

mapping = {}
with open(log_path, 'r') as f:
    for line in f:
        if "Updated " in line and " -> " in line:
            # Example line: Updated Tirzepatide: /images/products/tirzepatide-tr70.png -> /images/savage-brands/tirzepatide-70mg.jpg
            parts = line.strip().split(" -> ")
            if len(parts) == 2:
                old_url = parts[0].split(": ")[-1].strip()
                new_url = parts[1].strip()
                mapping['public' + old_url] = 'public' + new_url

logo_path = "public/images/logo-savage.jpg"
logo = Image.open(logo_path).convert("RGBA")

logo_size = 195
logo_resized = logo.resize((logo_size, logo_size))

mask = Image.new("L", logo_resized.size, 0)
draw = ImageDraw.Draw(mask)
draw.ellipse((0, 0, logo_size, logo_size), fill=255)
logo_resized.putalpha(mask)

count = 0
for src, dst in mapping.items():
    if not os.path.exists(src):
        print(f"Skipping {src}, not found")
        continue
    
    base = Image.open(src).convert("RGBA")
    
    x = base.width // 2 - logo_size // 2
    y = 458
    
    base.paste(logo_resized, (x, y), logo_resized)
    
    bg = Image.new("RGB", base.size, (255, 255, 255))
    bg.paste(base, mask=base.split()[3])
    
    bg.save(dst, quality=95)
    print(f"Generated {dst}")
    count += 1

print(f"Generated {count} total images.")
