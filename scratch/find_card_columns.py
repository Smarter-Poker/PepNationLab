from PIL import Image

img = Image.open('public/images/store_discovery_hero_v3.png')
w, h = img.size

# Let's check brightness in the bottom half: y from 600 to 800
# For each x, we check average brightness of y from 600 to 800
column_brightness = []
for x in range(w):
    b_sum = 0
    for y in range(600, 800):
        p = img.getpixel((x, y))
        b_sum += (p[0] + p[1] + p[2]) / 3
    column_brightness.append(b_sum / 200)

# Let's print local maxima or ranges where brightness is high, indicating card columns
# The card backgrounds are dark, but the silver borders are bright.
# Let's print peaks or ranges
in_card = False
start_x = 0
for x in range(w):
    b = column_brightness[x]
    if b > 25 and not in_card:
        in_card = True
        start_x = x
    elif b < 20 and in_card:
        in_card = False
        print(f"Bright column range: x={start_x}..{x} ({start_x/w*100:.1f}%..{x/w*100:.1f}%)")

if in_card:
    print(f"Bright column range: x={start_x}..{w} ({start_x/w*100:.1f}%..100.0%)")
