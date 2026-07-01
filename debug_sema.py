from PIL import Image
import os

img_path = "public/images/products/cagrilintide-sema.png"
os.system(f"git checkout 1d9c152b -- {img_path}")
img = Image.open(img_path).convert("RGBA")
pixels = img.load()

centers = [310, 714]
for x in centers:
    band_start = None
    for y in range(850, 700, -1):
        r, g, b = pixels[x, y][:3]
        if r > 210 and g > 210 and b > 210:
            band_start = y + 1
            print(f"For center x={x}, white label bottom is y={band_start}")
            break
            
    logo_end = None
    for y in range(band_start - 1, 600, -1):
        r, g, b = pixels[x, y][:3]
        if r < 100 and g < 100 and b < 100:
            logo_end = y
            print(f"For center x={x}, logo end is y={logo_end}")
            break
