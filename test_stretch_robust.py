from PIL import Image, ImageDraw, ImageFont
import os
import glob

def get_bottle_centers(pixels):
    centers = []
    # Check for left bottle
    for y in range(400, 600):
        r, g, b = pixels[310, y][:3]
        if r > 200 and g > 200 and b > 200:
            centers.append(310)
            break
            
    # Check for right bottle
    for y in range(400, 600):
        r, g, b = pixels[714, y][:3]
        if r > 200 and g > 200 and b > 200:
            centers.append(714)
            break
            
    if len(centers) == 0:
        centers.append(512)
        
    return centers

def find_label_bottom(pixels, x_center):
    # Scan upwards from 850 in a column of width 100
    for y in range(850, 700, -1):
        for x in range(x_center - 20, x_center + 20):
            r, g, b = pixels[x, y][:3]
            if r > 210 and g > 210 and b > 210:
                return y + 1
    return None

def find_logo_bottom(pixels, x_center, label_bottom):
    # Scan upwards from label_bottom in a wider column for dark pixels
    for y in range(label_bottom - 1, 600, -1):
        for x in range(x_center - 100, x_center + 100):
            r, g, b = pixels[x, y][:3]
            if r < 120 and g < 120 and b < 120:
                return y
    return None

def process_vial(img_path, font_path):
    img = Image.open(img_path).convert("RGBA")
    draw = ImageDraw.Draw(img)
    pixels = img.load()
    width, height = img.size
    
    centers = get_bottle_centers(pixels)

    font_size = 16 if len(centers) == 1 else 15
    font = ImageFont.truetype(font_path, font_size)
    text = "For Research Use Only"
    bbox = draw.textbbox((0, 0), text, font=font)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]

    modified = False

    for x in centers:
        band_start = find_label_bottom(pixels, x)
        if not band_start:
            print(f"Skipping {os.path.basename(img_path)} at x={x} - no clear white band start found.")
            continue

        logo_end = find_logo_bottom(pixels, x, band_start)
        if not logo_end:
            continue
            
        space = band_start - logo_end - 1
        stretch_amount = 0
        if space < 24: 
            stretch_amount = 24 - space
            
            # Find exact horizontal bounds of the white label at band_start - 5
            left_x = x
            while left_x > 0:
                r, g, b = pixels[left_x, band_start - 5][:3]
                if r < 100 and g < 100 and b < 100: break
                left_x -= 1
                
            right_x = x
            while right_x < width:
                r, g, b = pixels[right_x, band_start - 5][:3]
                if r < 100 and g < 100 and b < 100: break
                right_x += 1
                
            # Must add padding to avoid the black border dragging down!
            pad = 5
            clean_row = []
            for px in range(left_x + pad, right_x - pad):
                clean_row.append(pixels[px, band_start - 2])
                
            # Stretch down by overwriting the top of the colored band
            for y in range(band_start, band_start + stretch_amount):
                for px in range(left_x + pad, right_x - pad):
                    pixels[px, y] = clean_row[px - (left_x + pad)]

        new_band_start = band_start + stretch_amount
        text_y = new_band_start - 2
        
        draw.text((x - text_w // 2, text_y - text_h // 2), text, fill=(0,0,0,255), font=font)
        modified = True

    if modified:
        preview_path = "/Users/smarter.poker/.gemini/antigravity/brain/d42895c7-f522-47b1-87f7-86eaa6f77a14/preview_images/" + os.path.basename(img_path)
        img.convert("RGB").save(preview_path)
        print(f"Processed {os.path.basename(img_path)}")

if __name__ == "__main__":
    os.system("git checkout 1d9c152b -- public/images/products/*.png")
    font_path = "/System/Library/Fonts/Supplemental/Arial Narrow Bold.ttf"
    test_files = [
        "public/images/products/cagrilintide-sema.png",
        "public/images/products/lemon-bottle.png",
        "public/images/products/wolverine-stack.png",
        "public/images/products/cjc-1295-ipa.png",
        "public/images/products/l-carnitine-blend.png",
    ]
    for img_path in test_files:
        process_vial(img_path, font_path)
