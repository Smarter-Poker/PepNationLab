from PIL import Image, ImageDraw

img = Image.open('public/images/store_discovery_hero_v3.png').convert("RGBA")
draw = ImageDraw.Draw(img)
W, H = img.size

print(f"Image dimensions: {W}x{H}")

# Card mappings current coordinates
# Left = 0.78 + (index - 1) * 10.74
# Width = 9.77
# Top = 55.9
# Height = 39.7
for i in range(1, 10):
    left_pct = 0.78 + (i - 1) * 10.74
    width_pct = 9.77
    top_pct = 55.9
    height_pct = 39.7
    
    x0 = int((left_pct / 100.0) * W)
    y0 = int((top_pct / 100.0) * H)
    x1 = int(((left_pct + width_pct) / 100.0) * W)
    y1 = int(((top_pct + height_pct) / 100.0) * H)
    
    draw.rectangle([x0, y0, x1, y1], outline=(255, 0, 0, 255), width=2)
    print(f"Card {i}: x0={x0}, y0={y0}, x1={x1}, y1={y1}")

# Search bar current coordinates
# Left = 3.4%, Width = 93.2%, Top = 26.9%, Height = 11.5%
x0_search = int((3.4 / 100.0) * W)
y0_search = int((26.9 / 100.0) * H)
x1_search = int(((3.4 + 93.2) / 100.0) * W)
y1_search = int(((26.9 + 11.5) / 100.0) * H)
draw.rectangle([x0_search, y0_search, x1_search, y1_search], outline=(0, 255, 0, 255), width=2)
print(f"Search: x0={x0_search}, y0={y0_search}, x1={x1_search}, y1={y1_search}")

img.save('public/images/visualized_hotspots.png')
print("Visualized image saved to public/images/visualized_hotspots.png")
