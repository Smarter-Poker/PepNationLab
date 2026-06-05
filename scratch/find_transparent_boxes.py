from PIL import Image

img = Image.open('public/images/store_discovery_hero_v3.png')
w, h = img.size

# Let's find all pixels with alpha < 128
transparent_pixels = []
for y in range(h):
    for x in range(w):
        pixel = img.getpixel((x, y))
        if pixel[3] < 128:
            transparent_pixels.append((x, y))

if not transparent_pixels:
    print("No transparent pixels found!")
else:
    xs = [p[0] for p in transparent_pixels]
    ys = [p[1] for p in transparent_pixels]
    min_x, max_x = min(xs), max(xs)
    min_y, max_y = min(ys), max(ys)
    print(f"Transparent bounding box: x={min_x}..{max_x} ({min_x/w*100:.2f}%..{max_x/w*100:.2f}%), y={min_y}..{max_y} ({min_y/h*100:.2f}%..{max_y/h*100:.2f}%)")
