from PIL import Image
img = Image.open("public/images/course/mod2_pg5.png")
pixels = img.load()
width, height = img.size

# Look at x = 100 (which should intersect the boxes)
for y in range(0, height, 10):
    r,g,b = pixels[100, y][:3]
    brightness = (r+g+b)/3
    if brightness > 50:
        print(f"y={y}, %={y/height*100:.2f} (r={r},g={g},b={b})")
