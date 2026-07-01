from PIL import Image, ImageDraw, ImageFont
import os
import glob

# The 6 we already manually perfected
skip_files = [
    'l-carnitine-blend.png',
    'lemon-bottle.png',
    'cjc-1295-ipa.png',
    'cagrilintide-sema.png',
    'wolverine-stack.png',
    'glow-blend.png'
]

def process_vial(img_path, font_path):
    filename = os.path.basename(img_path)
    if filename in skip_files:
        return

    img = Image.open(img_path).convert("RGBA")
    draw = ImageDraw.Draw(img)
    pixels = img.load()
    
    # Detect centers
    centers = []
    def has_bottle(x):
        for y in range(400, 600):
            r, g, b = pixels[x, y][:3]
            if r > 200 and g > 200 and b > 200:
                return True
        return False

    if has_bottle(512):
        centers.append(512)
    elif has_bottle(310) and has_bottle(714):
        centers = [310, 714]
    else:
        centers.append(512)

    font_size = 13 if len(centers) == 1 else 11
    font = ImageFont.truetype(font_path, font_size)
    text = "For Research Use Only"
    bbox = draw.textbbox((0, 0), text, font=font)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]

    modified = False

    for x in centers:
        band_start = None
        for y in range(850, 750, -1):
            r, g, b = pixels[x, y][:3]
            if r < 50 and g < 50 and b < 50:
                continue
            # Band detection is slightly tricky with reflections. 
            # We look for the start of the white label.
            if r > 200 and g > 200 and b > 200:
                band_start = y + 1
                break

        if not band_start:
            print(f"Skipping {filename} at x={x} - no clear white band start found.")
            continue

        logo_end = None
        for y in range(band_start - 1, 700, -1):
            r, g, b = pixels[x, y][:3]
            # STRICT threshold for black text of "Pep Nation Lab"
            if r < 100 and g < 100 and b < 100:
                logo_end = y
                break
                
        if not logo_end:
            print(f"Skipping {filename} at x={x} - no dark logo text found.")
            continue

        space = band_start - logo_end - 1
        
        if space < 12:
            print(f"Skipping {filename} at x={x} - not enough space ({space}px).")
            continue
            
        text_y = logo_end + (space // 2)
        text_y += 1
        
        draw.text((x - text_w // 2, text_y - text_h // 2), text, fill=(0,0,0,255), font=font)
        modified = True

    if modified:
        img.convert("RGB").save(img_path)
        print(f"Processed {filename}")
    else:
        print(f"Left {filename} unmodified.")

def main():
    font_path = "/System/Library/Fonts/Supplemental/Arial Narrow Bold.ttf"
    for img_path in glob.glob("public/images/products/*.png"):
        process_vial(img_path, font_path)

if __name__ == "__main__":
    main()
