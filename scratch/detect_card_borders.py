from PIL import Image

img = Image.open('public/images/store_discovery_hero_v3.png')
w, h = img.size

# Let's inspect a horizontal slice at y=750.
# We want to identify the columns of the cards by finding the silver borders.
# A silver pixel has R, G, B >= 120 and |R-G| <= 10, |G-B| <= 10, |B-R| <= 10.
silver_cols = []
for x in range(w):
    pixel = img.getpixel((x, 750))
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

print("Silver columns found at y=750:")
for r in ranges:
    print(f"x={r[0]}..{r[1]} ({r[0]/w*100:.2f}%..{r[1]/w*100:.2f}%)")
