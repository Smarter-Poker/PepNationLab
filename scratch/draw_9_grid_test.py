from PIL import Image, ImageDraw

img = Image.open('public/images/store_discovery_hero_v3.png').convert("RGBA")
draw = ImageDraw.Draw(img)
w, h = img.size

# Let's draw 9 boxes of equal size at the bottom.
# Total width of cards container: roughly from 3% to 97% of width.
# Bottom cards height: roughly from y = 500 to y = 900.
card_y0 = 500
card_y1 = 900

l_margin = 0.03
r_margin = 0.03
gap = 0.008

W_cards = 1.0 - l_margin - r_margin
# W_cards = 9 * card_w + 8 * gap
card_w = (W_cards - 8 * gap) / 9

print(f"Calculated card width: {card_w*w:.1f} pixels")

for i in range(9):
    l = l_margin + i * (card_w + gap)
    r = l + card_w
    
    x0 = int(l * w)
    x1 = int(r * w)
    
    draw.rectangle([(x0, card_y0), (x1, card_y1)], outline="lime", width=3)
    # Draw index number
    draw.text((x0 + 10, card_y0 + 10), str(i+1), fill="yellow")

img.save('public/images/research/boxes_9_test.png')
print("Saved 9-box grid test to public/images/research/boxes_9_test.png")
