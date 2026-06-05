from PIL import Image

img = Image.open('public/images/store_discovery_hero_v3.png')
w, h = img.size

print("Checking pixels at y=750:")
for x in range(w):
    p = img.getpixel((x, 750))
    # print if brightness > 80 and abs(r-g) < 15 and abs(g-b) < 15
    r, g, b = p[0], p[1], p[2]
    brightness = (r + g + b) / 3
    if brightness > 120 and abs(r-g) < 15 and abs(g-b) < 15:
        print(f"x={x:4d} ({x/w*100:5.2f}%): brightness={brightness:.1f} color={p}")
