import os
from PIL import Image

badge_dir = "/Users/smarter.poker/Documents/pepnationlab/public/images/badges"
img_name = "badge_research_compound.png"
path = os.path.join(badge_dir, img_name)

img = Image.open(path)
width, height = img.size

print("--- Column-by-column non-transparent pixel count on left ---")
for x in range(40):
    col_pixels = [img.getpixel((x, y)) for y in range(height)]
    non_zero = sum(1 for p in col_pixels if p[3] > 0)
    print(f"Col {x:2}: {non_zero}")
