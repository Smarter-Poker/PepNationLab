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

def process_vial(img_path, font_path):
    img = Image.open(img_path).convert("RGBA")
    draw = ImageDraw.Draw(img)
    pixels = img.load()
    
    centers = get_bottle_centers(pixels)

    font_size = 14 if len(centers) == 1 else 13
    font = ImageFont.truetype(font_path, font_size)
    text = "For Research Use Only"
    bbox = draw.textbbox((0, 0), text, font=font)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]

    modified = False
    
    # We will just place it at y=803 for single bottles, y=805 for double bottles
    # No dynamic scanning! The bottles are all standardized 3D renders!
    # The logo ends at ~795. The band starts at ~812.
    # Center is ~803.5.
    
    for x in centers:
        text_y = 804
        
        # Draw 1px white outline to ensure it's always readable even if it touches red
        outline_color = (255, 255, 255, 255)
        for dx in [-1, 0, 1]:
            for dy in [-1, 0, 1]:
                if dx == 0 and dy == 0:
                    continue
                draw.text((x - text_w // 2 + dx, text_y - text_h // 2 + dy), text, fill=outline_color, font=font)

        # Draw black text
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
