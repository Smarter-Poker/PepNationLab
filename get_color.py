from PIL import Image

img = Image.open('public/images/store_discovery_hero.png')
# Search bar is roughly in the middle. Let's sample a pixel around x=300, y=240
pixels = []
for x in [300, 400, 500]:
    for y in [240, 250, 260]:
        pixels.append(img.getpixel((x, y)))
print(pixels)
