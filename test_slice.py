from PIL import Image

img_path = "public/images/products/l-carnitine-blend.png"
img = Image.open(img_path).convert("RGBA")
pixels = img.load()

# We want to clear the area from y=750 to y=815
# The width of the label is roughly x=280 to x=740
# Let's find the exact bounds of the white label at y=730
left_x = None
right_x = None
for x in range(200, 512):
    r, g, b = pixels[x, 730][:3]
    if r > 100 and g > 100 and b > 100: # White label starts
        left_x = x
        break
for x in range(800, 512, -1):
    r, g, b = pixels[x, 730][:3]
    if r > 100 and g > 100 and b > 100:
        right_x = x
        break

print(f"Label bounds: {left_x} to {right_x}")

# Extract a clean row of pixels from y=730
clean_row = []
for x in range(left_x, right_x + 1):
    clean_row.append(pixels[x, 730])

# Copy this row down to overwrite the logo area!
for y in range(745, 815):
    for x in range(left_x, right_x + 1):
        pixels[x, y] = clean_row[x - left_x]

img.convert("RGB").save("/Users/smarter.poker/.gemini/antigravity/brain/d42895c7-f522-47b1-87f7-86eaa6f77a14/preview_images/l-carnitine-blend_canvas.png")
print("Done")
