import os
import textwrap
from PIL import Image, ImageDraw, ImageFont

base_dir = "/Users/smarter.poker/Documents/pepnationlab/public/images/areas"
template_path = f"{base_dir}/perfect_template.png"
icons_dir = f"{base_dir}/icons"

template = Image.open(template_path).convert("RGBA")
W, H = template.size

font_title = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Bold.ttf", 60)
font_desc = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", 36)

areas = {
    "tissue_repair": ("Tissue Repair", "Compounds Studied For Tendon, Ligament, Muscle,\nAnd Wound Repair."),
    "healing": ("Healing & Recovery", "Compounds Studied For Healing, Cytoprotection,\nAnd Recovery."),
    "metabolic": ("Metabolic", "Compounds Studied For Metabolism, Glucose, And\nFat Regulation."),
    "weight_management": ("Weight Management\n& Fat Loss", "GLP-1 / GIP / Incretins, AOD9604, Tesamorelin,\nAnd Related Fat-axis Compounds."),
    "longevity": ("Longevity", "Compounds Studied For Aging, Senescence,\nAnd Healthspan."),
    "cosmetic": ("Skin & Hair", "Compounds Studied For Skin, Hair, And\nCosmetic Applications."),
    "cognitive": ("Cognitive", "Compounds Studied For Cognition, Mood,\nAnd Neuroprotection."),
    "immune": ("Immune", "Compounds Studied For Immune Modulation\nAnd Response."),
    "gut_health": ("Gut Health", "Compounds Studied For Microbiome, Digestion,\nAnd GI Repair."),
    "pain_inflammation": ("Pain & Inflammation", "Compounds Studied For Analgesia And\nAnti-inflammatory Pathways."),
    "bone_joint": ("Bone & Joint", "Compounds Studied For Osteogenesis And\nCartilage Repair."),
    "sexual_health": ("Sexual Health", "Compounds Studied For Libido, Vitality,\nAnd Sexual Function."),
    "performance": ("Performance", "Compounds Studied For Athletic Performance\nAnd Muscle Growth."),
    "sleep": ("Sleep", "Compounds Studied For Insomnia, Sleep Quality,\nAnd Circadian Rhythm."),
    "mitochondrial": ("Mitochondrial", "Compounds Studied For Cellular Energy And\nATP Production.")
}

for key, (title, desc) in areas.items():
    print(f"Baking {key}...")
    img = template.copy()
    draw = ImageDraw.Draw(img)
    
    # 1. Overlay Icon
    icon_path = f"{icons_dir}/{key}.png"
    if os.path.exists(icon_path):
        icon = Image.open(icon_path).convert("RGBA")
        # Resize icon to fit nicely. Icons are 1024x1024. Let's make them 350x350
        icon = icon.resize((350, 350), Image.Resampling.LANCZOS)
        iw, ih = icon.size
        # Paste icon centered horizontally, at a specific Y
        icon_y = 170
        icon_x = (W - iw) // 2
        img.paste(icon, (icon_x, icon_y), icon)
    else:
        print(f"Warning: Icon not found for {key}")
        
    # 2. Draw Title
    # If title has newline, calculate total height
    lines = title.split("\n")
    y_text = 540
    for line in lines:
        bbox = draw.textbbox((0, 0), line, font=font_title)
        lw = bbox[2] - bbox[0]
        draw.text(((W - lw) / 2, y_text), line, font=font_title, fill=(255, 255, 255, 255))
        y_text += 70 # line height

    # 3. Draw Description
    # We already manually split lines above for perfect wrapping
    y_desc = y_text + 20
    for line in desc.split("\n"):
        bbox = draw.textbbox((0, 0), line, font=font_desc)
        lw = bbox[2] - bbox[0]
        draw.text(((W - lw) / 2, y_desc), line, font=font_desc, fill=(163, 176, 190, 255)) # Grey color
        y_desc += 50
        
    img.save(f"{base_dir}/{key}.png")

print("All baked perfectly!")
