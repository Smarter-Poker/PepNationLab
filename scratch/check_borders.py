from PIL import Image

img = Image.open('public/images/store_discovery_hero_v3.png')
w, h = img.size

borders = [
    (24, 186),
    (202, 364),
    (380, 542),
    (558, 720),
    (736, 898),
    (914, 1076),
    (1092, 1254),
    (1270, 1432),
    (1448, 1610)
]

for idx, (left, right) in enumerate(borders):
    print(f"\nCard {idx+1}:")
    
    # Print average brightness in window around left
    l_pixels = []
    for dx in range(-3, 4):
        x = left + dx
        p = img.getpixel((x, 750))
        b = (p[0] + p[1] + p[2]) / 3
        l_pixels.append(f"{x}:{b:.1f}")
    print(f"  Left ({left}): {', '.join(l_pixels)}")
    
    # Print average brightness in window around right
    r_pixels = []
    for dx in range(-3, 4):
        x = right + dx
        p = img.getpixel((x, 750))
        b = (p[0] + p[1] + p[2]) / 3
        r_pixels.append(f"{x}:{b:.1f}")
    print(f"  Right ({right}): {', '.join(r_pixels)}")
