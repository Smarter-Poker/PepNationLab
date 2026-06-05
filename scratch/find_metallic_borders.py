from PIL import Image
import numpy as np

img = Image.open('public/images/store_discovery_hero_v3.png').convert('L')
arr = np.array(img)

# Let's inspect a horizontal slice at y=350 (middle of the card heights)
y = 350
row_pixels = arr[y, :]

# Print the pixel values at the left edge (0 to 50) and right edge (970 to 1024)
print("Left edge pixel values (x=0 to 50):")
print(list(row_pixels[0:50]))

print("\nRight edge pixel values (x=974 to 1024):")
print(list(row_pixels[974:1024]))

# Find where the brightness rises above 30 (which indicates card frame)
threshold = 30
card_cols = np.where(row_pixels > threshold)[0]

if len(card_cols) > 0:
    print(f"\nFirst bright pixel at x={card_cols[0]}")
    print(f"Last bright pixel at x={card_cols[-1]}")
else:
    print("\nNo pixels found above threshold.")
