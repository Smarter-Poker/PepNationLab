from PIL import Image

img = Image.open('public/images/store_discovery_hero_v3.png')
w, h = img.size

print("Pixels at y=750 from x=1550 to 1672:")
for x in range(1550, 1672):
    pixel = img.getpixel((x, 750))
    print(f"x={x:4d} ({x/w*100:5.2f}%): {pixel}")
