from PIL import Image

img = Image.open('public/images/products/glow-tb10-bpc10-ghk50-bbg70.png')
w, h = img.size

pixels = img.load()
top_y = None
bottom_y = None
for y in range(300, 700):
    r, g, b = pixels[w//2, y][:3]
    # silver globe and text
    is_silver = (r > 150 and g > 150 and b > 150)
    if is_silver and top_y is None:
        top_y = y
    if not is_silver and top_y is not None:
        # Need to be careful about spaces in the logo, let's just find the max bounds
        pass

# Instead let's just scan the center 200 pixels width
min_y = 1000
max_y = 0
for x in range(w//2 - 100, w//2 + 100):
    for y in range(350, 650):
        r, g, b = pixels[x, y][:3]
        if r > 150 and g > 150 and b > 150:
            min_y = min(min_y, y)
            max_y = max(max_y, y)

print(f"Logo bounds: y={min_y} to y={max_y}, height={max_y - min_y}")
