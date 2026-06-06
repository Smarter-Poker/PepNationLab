import os
from PIL import Image

badge_dir = "/Users/smarter.poker/Documents/pepnationlab/public/images/badges"
img_name = "badge_research_compound.png"
path = os.path.join(badge_dir, img_name)

img = Image.open(path)
width, height = img.size

# Let's print the alpha values for a 20x20 region at the top-left (around the cut-off)
# The non-transparent pixels start around y = (341 - 112)//2 = 114
start_y = (height - 112) // 2
for y in range(start_y - 5, start_y + 15):
    row_str = ""
    for x in range(20):
        p = img.getpixel((x, y))
        a = p[3] if len(p) == 4 else 255
        if a == 0:
            row_str += "  "
        elif a < 100:
            row_str += ". "
        elif a < 200:
            row_str += "x "
        else:
            row_str += "M "
    print(f"y={y:3}: {row_str}")
