from PIL import Image, ImageDraw, ImageFont
import os
import glob
import multiprocessing

def get_bottle_centers(pixels):
    # Check if the exact center of the image has a bottle label
    is_single_bottle = False
    for y in range(400, 600):
        r, g, b = pixels[512, y][:3]
        # The center of a double-bottle image is pure black background.
        # If we see any bright pixels here, it's a single bottle.
        if r > 150 and g > 150 and b > 150:
            is_single_bottle = True
            break
            
    if is_single_bottle:
        return [512]
    else:
        # It's a double bottle (e.g. wolverine-stack, cagrilintide-sema)
        return [310, 714]

def process_vial(img_path):
    font_path = "/System/Library/Fonts/Supplemental/Arial Narrow Bold.ttf"
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
    
    for x in centers:
        # Precisely placed to avoid overlapping the logo too much while remaining entirely inside the white space
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
        img.convert("RGB").save(img_path)

def process_chunk(files):
    for f in files:
        process_vial(f)

if __name__ == "__main__":
    os.system("git checkout 1d9c152b -- public/images/products/*.png")
    
    all_files = glob.glob("public/images/products/*.png")
    
    # Process all files using multiprocessing for speed
    pool = multiprocessing.Pool(processes=multiprocessing.cpu_count())
    
    chunk_size = len(all_files) // multiprocessing.cpu_count() + 1
    chunks = [all_files[i:i + chunk_size] for i in range(0, len(all_files), chunk_size)]
    
    pool.map(process_chunk, chunks)
    pool.close()
    pool.join()
    
    print(f"Successfully processed all {len(all_files)} images.")
