from PIL import Image

img = Image.open('public/images/store_discovery_hero_v3.png')
w, h = img.size

# Let's inspect the search bar. We can search for the silver border of the search bar.
# In the 2nd screenshot, the search bar is located horizontally from about 5% to 95%.
# Let's find where the search bar border starts and ends.
# We can print the colors along the vertical center x=w//2.
print("Vertical center slice (x = 836):")
for y in range(220, 360, 5):
    pixel = img.getpixel((w//2, y))
    print(f"y={y:3d} ({y/h*100:4.1f}%): {pixel}")

# Let's inspect the cards at the bottom.
# The cards are in a row. Let's print colors along a horizontal line at y=700 (about 74% height).
print("\nHorizontal slice at y=700 (x from 0 to w in steps of 20):")
for x in range(0, w, 25):
    pixel = img.getpixel((x, 700))
    # print x and brightness
    brightness = (pixel[0] + pixel[1] + pixel[2]) / 3
    if brightness > 40:
        print(f"x={x:4d} ({x/w*100:4.1f}%): brightness={brightness:.1f}")
