from PIL import Image

img = Image.open('/Users/smarter.poker/.gemini/antigravity/brain/6572f236-d119-4cf1-bf66-a49d69174aaa/media__1780680767590.jpg')
w, h = img.size
print("New Image size:", w, "x", h)

# Let's inspect a horizontal slice at y=430 (since h=512)
# We want to identify the columns of the cards by finding the silver borders.
# A silver pixel has R, G, B >= 100 and |R-G| <= 15, |G-B| <= 15, |B-R| <= 15.
silver_cols = []
for x in range(w):
    pixel = img.getpixel((x, 430))
    r, g, b = pixel[0], pixel[1], pixel[2]
    if r >= 100 and g >= 100 and b >= 100 and abs(r-g) <= 15 and abs(g-b) <= 15 and abs(b-r) <= 15:
        silver_cols.append(x)

# Let's group consecutive silver columns
ranges = []
if silver_cols:
    start = silver_cols[0]
    prev = silver_cols[0]
    for x in silver_cols[1:]:
        if x - prev > 5:
            ranges.append((start, prev))
            start = x
        prev = x
    ranges.append((start, prev))

print("Silver columns found at y=430:")
for r in ranges:
    print(f"x={r[0]}..{r[1]} ({r[0]/w*100:.2f}%..{r[1]/w*100:.2f}%)")
