from PIL import Image
import sys

img = Image.open(sys.argv[1]).convert("RGB")
width, height = img.size

# Find the "Enable Notifications" button which is a light beige color.
# We'll look for pixels with high red/green (beige) in the lower half.
# Find the "Not Now" button which is a dark grey, but has a lighter border.

def find_bounds(color_cond):
    min_y = height
    max_y = 0
    min_x = width
    max_x = 0
    found = False
    for y in range(height):
        for x in range(width):
            r, g, b = img.getpixel((x, y))
            if color_cond(r, g, b, y):
                min_y = min(min_y, y)
                max_y = max(max_y, y)
                min_x = min(min_x, x)
                max_x = max(max_x, x)
                found = True
    return (min_x, min_y, max_x, max_y) if found else None

# Beige button: high r, g > 150
beige_bounds = find_bounds(lambda r, g, b, y: y > height/2 and r > 180 and g > 180 and b > 140)
print(f"Beige: {beige_bounds}, img size: {width}x{height}")

if beige_bounds:
    bx1, by1, bx2, by2 = beige_bounds
    print(f"Beige top: {by1/height:.2%}, left: {bx1/width:.2%}, width: {(bx2-bx1)/width:.2%}, height: {(by2-by1)/height:.2%}")

# The "Not Now" button is below the beige button. Let's just find the bounding box of anything not purely black in the area below the beige button.
if beige_bounds:
    dark_bounds = find_bounds(lambda r, g, b, y: y > by2 + 10 and y < height - 50 and (r > 30 or g > 30 or b > 30))
    print(f"Dark: {dark_bounds}")
    if dark_bounds:
        dx1, dy1, dx2, dy2 = dark_bounds
        print(f"Dark top: {dy1/height:.2%}, left: {dx1/width:.2%}, width: {(dx2-dx1)/width:.2%}, height: {(dy2-dy1)/height:.2%}")
