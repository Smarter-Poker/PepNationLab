from PIL import Image, ImageDraw

img = Image.open('public/images/store_discovery_hero_v3.png').convert("RGBA")
draw = ImageDraw.Draw(img)
w, h = img.size

# Let's define the 9 cards' exact coordinates based on the 162px card width and 16px gap model
card_w = 162
gap = 16
start_x = 24
card_y0 = 510
card_y1 = 890

for i in range(9):
    x0 = start_x + i * (card_w + gap)
    x1 = x0 + card_w
    
    draw.rectangle([(x0, card_y0), (x1, card_y1)], outline="magenta", width=3)
    draw.text((x0 + 10, card_y0 + 10), f"Card {i+1}", fill="yellow")

img.save('public/images/research/boxes_9_test_exact.png')
print("Saved exact 9-box grid test to public/images/research/boxes_9_test_exact.png")
