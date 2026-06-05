from PIL import Image, ImageDraw

img = Image.open('public/images/store_discovery_hero_v3.png').convert("RGBA")
draw = ImageDraw.Draw(img)
w, h = img.size

# Detected silver columns
silver_lines = [
    24, 41, 73, 79, 255, 260, 274, 279, 457, 463, 475, 480, 
    654, 659, 672, 677, 847, 851, 864, 870, 1039, 1044, 
    1057, 1062, 1228, 1233, 1246, 1252, 1413, 1418, 1431, 
    1436, 1589, 1593, 1629, 1646
]

for x in silver_lines:
    draw.line([(x, 0), (x, h)], fill="red", width=2)

img.save('public/images/research/boxes_test_v3.png')
print("Saved grid test to public/images/research/boxes_test_v3.png")
