from PIL import Image, ImageDraw

img = Image.open('public/images/store_discovery_hero_v3.png').convert("RGBA")
draw = ImageDraw.Draw(img)
W, H = img.size

# Refined coordinates:
# Left margin = 13px, Card width = 98px, Card height = y 286 to 489, Spacing = 112.5px
margin_left = 13
card_width = 98
spacing = 112.5

y0 = 286
y1 = 489

for i in range(9):
    x0 = int(margin_left + i * spacing)
    x1 = x0 + card_width
    
    # Calculate percentages for the front-end style attribute
    left_pct = (x0 / W) * 100.0
    width_pct = (card_width / W) * 100.0
    
    draw.rectangle([x0, y0, x1, y1], outline=(0, 255, 0, 255), width=2)
    print(f"Card {i+1}: x0={x0}, x1={x1} (left_pct={left_pct:.3f}%, width_pct={width_pct:.3f}%)")

img.save('public/images/refined_hotspots.png')
print("Visualized image saved to public/images/refined_hotspots.png")
