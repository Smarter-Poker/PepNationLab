import os
import textwrap
from PIL import Image, ImageDraw, ImageFont

base_dir = "/Users/smarter.poker/Documents/pepnationlab/public/images/areas"
template_path = f"{base_dir}/perfect_template.png"
icons_dir = f"{base_dir}/icons"

template = Image.open(template_path).convert("RGBA")
W, H = template.size

font_title = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Bold.ttf", 95)

areas = {
    "tissue_repair": "Tissue Repair",
    "healing": "Healing & Recovery",
    "metabolic": "Metabolic",
    "weight_management": "Weight Management\n& Fat Loss",
    "longevity": "Longevity",
    "cosmetic": "Skin & Hair",
    "cognitive": "Cognitive",
    "immune": "Immune",
    "gut_health": "Gut Health",
    "pain_inflammation": "Pain & Inflammation",
    "bone_joint": "Bone & Joint",
    "sexual_health": "Sexual Health",
    "performance": "Performance",
    "sleep": "Sleep",
    "mitochondrial": "Mitochondrial"
}

for key, title in areas.items():
    print(f"Baking {key}...")
    img = template.copy()
    draw = ImageDraw.Draw(img)
    
    # 1. Overlay Icon
    icon_path = f"{icons_dir}/{key}.png"
    if os.path.exists(icon_path):
        icon = Image.open(icon_path).convert("RGBA")
        # Resize to be massive
        icon = icon.resize((550, 550), Image.Resampling.LANCZOS)
        iw, ih = icon.size
        # Center horizontally, push up to make room for large text
        icon_y = 110
        icon_x = (W - iw) // 2
        img.paste(icon, (icon_x, icon_y), icon)
    else:
        print(f"Warning: Icon not found for {key}")
        
    # 2. Draw Title
    lines = title.split("\n")
    y_text = 680
    for line in lines:
        bbox = draw.textbbox((0, 0), line, font=font_title)
        lw = bbox[2] - bbox[0]
        draw.text(((W - lw) / 2, y_text), line, font=font_title, fill=(255, 255, 255, 255))
        y_text += 110 # line height

    img.save(f"{base_dir}/{key}.png")

print("All baked perfectly!")
