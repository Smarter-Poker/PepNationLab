import os
from PIL import Image

badge_dir = "/Users/smarter.poker/Documents/pepnationlab/public/images/badges"
img_name = "trophy_1st_choice.png"
path = os.path.join(badge_dir, img_name)

img = Image.open(path)
width, height = img.size

print("--- Top edge of trophy_1st_choice ---")
for y in range(15):
    row_pixels = [img.getpixel((x, y)) for x in range(width)]
    alpha_vals = [p[3] if len(p) == 4 else 255 for p in row_pixels]
    non_zero = sum(1 for a in alpha_vals if a > 0)
    print(f"Row {y}: {non_zero}/{width} non-transparent pixels, max alpha: {max(alpha_vals)}")
