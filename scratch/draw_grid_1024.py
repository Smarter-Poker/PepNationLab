from PIL import Image, ImageDraw

img = Image.open('/Users/smarter.poker/.gemini/antigravity/brain/6572f236-d119-4cf1-bf66-a49d69174aaa/media__1780680767590.jpg').convert("RGBA")
draw = ImageDraw.Draw(img)
w, h = img.size

# Let's draw horizontal lines at every 10% of height, and vertical lines at every 10% of width
for x in range(0, w, int(w/10)):
    draw.line([(x, 0), (x, h)], fill="cyan", width=1)
    draw.text((x + 2, 10), f"{x/w*100:.0f}%", fill="cyan")

for y in range(0, h, int(h/10)):
    draw.line([(0, y), (w, y)], fill="yellow", width=1)
    draw.text((10, y + 2), f"{y/h*100:.0f}%", fill="yellow")

# Let's draw our guess for the search bar:
# Horizontal span: left=3.5%, right=96.5%? (from previous logic: 22..1647 out of 1672 = 1.3% to 98.5%)
# Vertical span: top=25.5%, bottom=35.6%? (from previous logic: y=240..335 out of 941 = 25.5% to 35.6%)
# On 1024x512:
# Search bar top is roughly y=130 (25.4%), bottom is roughly y=182 (35.5%)
# Mapped to y0 = 0.255 * 512 = 130, y1 = 0.356 * 512 = 182.
# Let's check card container y:
# Card container top is y=278 (54.3%), bottom is y=484 (94.5%)
# Mapped to y0 = 0.542 * 512 = 277, y1 = 0.945 * 512 = 484.
# Let's draw these guessed boxes
draw.rectangle([(int(0.013*w), int(0.255*h)), (int(0.985*w), int(0.356*h))], outline="lime", width=3)

# 9 Cards
for i in range(9):
    left = 1.4 + i * 10.7
    width = 10.4
    x0 = int(left / 100 * w)
    x1 = int((left + width) / 100 * w)
    y0 = int(0.542 * h)
    y1 = int(0.945 * h)
    draw.rectangle([(x0, y0), (x1, y1)], outline="magenta", width=2)
    draw.text((x0 + 4, y0 + 4), str(i+1), fill="white")

img.save('/Users/smarter.poker/Documents/pepnationlab/public/images/research/boxes_1024_test.png')
print("Saved grid test to public/images/research/boxes_1024_test.png")
