import subprocess
from PIL import Image, ImageDraw

# Open the beautiful healing image
img = Image.open("/Users/smarter.poker/Documents/pepnationlab/public/images/areas/healing.png").convert("RGBA")

# We want to keep the frame, but erase everything inside.
# The frame seems to end around pixel 110 from each edge.
# We will draw a filled rectangle with the exact background color to cover the icon and text.
# The background color of the matte healing image is around (29, 31, 34)
# Let's sample a pixel from the inner frame area.
bg_color = img.getpixel((150, 150))

draw = ImageDraw.Draw(img)
# Coordinates for the interior:
# Image is 1024x1024. Let's cover from 110, 110 to 914, 914
draw.rectangle([110, 110, 914, 914], fill=bg_color)

img.save("/Users/smarter.poker/Documents/pepnationlab/public/images/areas/perfect_template.png")
