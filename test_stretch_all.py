from PIL import Image, ImageDraw, ImageFont
import os
import glob

# Ensure all files are in their clean original state before we begin processing!
os.system("git checkout 1d9c152b -- public/images/products/*.png")

def process_vial(img_path, font_path):
    img = Image.open(img_path).convert("RGBA")
    draw = ImageDraw.Draw(img)
    pixels = img.load()
    width, height = img.size
    
    centers = []
    
    def has_bottle(x):
        for y in range(400, 600): # Check inside the white label area
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

    font_size = 16 if len(centers) == 1 else 15
    font = ImageFont.truetype(font_path, font_size)
    text = "For Research Use Only"
    bbox = draw.textbbox((0, 0), text, font=font)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]

    modified = False

    for x in centers:
        # Find the start of the colored band
        band_start = None
        for y in range(850, 750, -1):
            r, g, b = pixels[x, y][:3]
            if r < 50 and g < 50 and b < 50:
                continue
            if r > 210 and g > 210 and b > 210:
                band_start = y + 1
                break

        if not band_start:
            print(f"Skipping {os.path.basename(img_path)} at x={x} - no clear white band start found.")
            continue

        # Check if the logo ends very high (like glow-blend)
        # If so, we don't need to stretch!
        logo_end = None
        for y in range(band_start - 1, 700, -1):
            r, g, b = pixels[x, y][:3]
            if r < 100 and g < 100 and b < 100:
                logo_end = y
                break
                
        if not logo_end:
            continue
            
        space = band_start - logo_end - 1
        
        stretch_amount = 0
        if space < 24: # We need at least 24 pixels for font size 16 to breathe comfortably
            stretch_amount = 24 - space
            
            # Find bounds of white label
            left_x = x
            while left_x > 0:
                r, g, b = pixels[left_x, band_start - 5][:3]
                if r < 100 and g < 100 and b < 100:
                    break
                left_x -= 1
                
            right_x = x
            while right_x < width:
                r, g, b = pixels[right_x, band_start - 5][:3]
                if r < 100 and g < 100 and b < 100:
                    break
                right_x += 1
                
            # Extract clean row
            clean_row = []
            for px in range(left_x + 3, right_x - 3):
                clean_row.append(pixels[px, band_start - 2])
                
            # Overwrite the top `stretch_amount` pixels of the band!
            for y in range(band_start, band_start + stretch_amount):
                for px in range(left_x + 3, right_x - 3):
                    pixels[px, y] = clean_row[px - (left_x + 3)]

        new_band_start = band_start + stretch_amount
        # Place text 4 pixels above the new band start
        text_y = new_band_start - 2
        
        draw.text((x - text_w // 2, text_y - text_h // 2), text, fill=(0,0,0,255), font=font)
        modified = True

    if modified:
        preview_path = "/Users/smarter.poker/.gemini/antigravity/brain/d42895c7-f522-47b1-87f7-86eaa6f77a14/preview_images/" + os.path.basename(img_path)
        img.convert("RGB").save(preview_path)
        print(f"Processed {os.path.basename(img_path)}")

def main():
    font_path = "/System/Library/Fonts/Supplemental/Arial Narrow Bold.ttf"
    test_files = [
        "public/images/products/cagrilintide-sema.png",
        "public/images/products/lemon-bottle.png",
        "public/images/products/wolverine-stack.png",
        "public/images/products/cjc-1295-ipa.png"
    ]
    for img_path in test_files:
        process_vial(img_path, font_path)

if __name__ == "__main__":
    main()
