import cv2
import numpy as np

# Read logo_crop.png
img = cv2.imread('logo_crop.png')

# The claws are bright cyan. Let's sample a few points
print("Color at (350, 50):", img[50, 350])
print("Color at (450, 60):", img[60, 450])
print("Color at (380, 250):", img[250, 380])
print("Color at (480, 260):", img[260, 480])

# Let's find the median non-black/non-white color in the top half
top_half = img[0:150, 200:600]
colors = []
for row in top_half:
    for pixel in row:
        b, g, r = pixel
        # If it's cyan-ish (high B and G, low R)
        if b > 150 and g > 150 and r < 100:
            colors.append((b, g, r))

colors = np.array(colors)
median_color = np.median(colors, axis=0)
print("Median Cyan Color:", median_color)
