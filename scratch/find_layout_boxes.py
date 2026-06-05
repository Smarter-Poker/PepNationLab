from PIL import Image

img = Image.open('public/images/store_discovery_hero_v3.png')
w, h = img.size
print(f"Image dimensions: {w}x{h}")

# Let's inspect vertical rows. We can print the average brightness/color of horizontal strips
# to see where text/boxes/bars are located.
for y in range(0, h, 20):
    row_sum = 0
    for x in range(0, w, 10):
        pixel = img.getpixel((x, y))
        # brightness approximation
        row_sum += (pixel[0] + pixel[1] + pixel[2]) / 3
    avg_brightness = row_sum / (w / 10)
    print(f"Row {y:3d} ({y/h*100:4.1f}%): brightness={avg_brightness:6.1f}")
