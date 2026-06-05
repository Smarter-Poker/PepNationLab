from PIL import Image

img = Image.open('/Users/smarter.poker/.gemini/antigravity/brain/6572f236-d119-4cf1-bf66-a49d69174aaa/media__1780680767590.jpg')
w, h = img.size

# Let's find the vertical coordinates of the search bar.
# The search bar has a bright silver/white border. Let's scan along x=200 for y=50 to 250
search_y = []
for y in range(50, 250):
    p = img.getpixel((200, y))
    # Silver pixel signature: bright, low color saturation
    r, g, b = p[0], p[1], p[2]
    brightness = (r + g + b) / 3
    is_silver = r >= 100 and g >= 100 and b >= 100 and abs(r-g) <= 10 and abs(g-b) <= 10 and abs(b-r) <= 10
    if is_silver:
        search_y.append((y, brightness))

print("Silver borders found along x=200:")
for sy in search_y:
    print(f"y={sy[0]} (brightness={sy[1]:.1f})")

# Let's do the same scan vertically along x=100 (which passes through card 1)
# The card row has silver top and bottom borders.
card_y = []
for y in range(250, 500):
    p = img.getpixel((100, y))
    r, g, b = p[0], p[1], p[2]
    brightness = (r + g + b) / 3
    is_silver = r >= 100 and g >= 100 and b >= 100 and abs(r-g) <= 10 and abs(g-b) <= 10 and abs(b-r) <= 10
    if is_silver:
        card_y.append((y, brightness))

print("Silver borders found along x=100 (in bottom half):")
for cy in card_y:
    print(f"y={cy[0]} (brightness={cy[1]:.1f})")
