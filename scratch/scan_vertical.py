from PIL import Image

img = Image.open('/Users/smarter.poker/Brain/6572f236-d119-4cf1-bf66-a49d69174aaa/media__1780680767590.jpg' if False else '/Users/smarter.poker/.gemini/antigravity/brain/6572f236-d119-4cf1-bf66-a49d69174aaa/media__1780680767590.jpg')
w, h = img.size

# Let's check vertical slices at x=50, 150, 250, 350, 450, 550, 650, 750, 850, 950 to see where brightness is high or card features exist
# Specifically, we want to know the y range of the search input bar.
# The search input bar is a horizontal bar at y roughly around 120-180?
# Let's print pixel brightness at x=512 for all y to detect the search bar and card container vertical spans.
brightness_y = []
for y in range(h):
    p = img.getpixel((512, y))
    brightness_y.append((p[0] + p[1] + p[2]) / 3)

# Search bar detection: usually has a bright silver border around it.
# Card row detection: cards are in the bottom half.
# Let's inspect the image vertically
for y in range(0, h, 10):
    print(f"y={y:3d} ({y/h*100:4.1f}%): brightness={brightness_y[y]:5.1f}")
