import cv2
import numpy as np

img = cv2.imread('correct_claws_bg.png', cv2.IMREAD_UNCHANGED)
if img.shape[2] == 3:
    # Add alpha channel if it doesn't have one
    img = cv2.cvtColor(img, cv2.COLOR_BGR2BGRA)

# Anything that is black (R < 10, G < 10, B < 10) becomes transparent
mask = (img[:, :, 0] < 15) & (img[:, :, 1] < 15) & (img[:, :, 2] < 15)
img[mask, 3] = 0

cv2.imwrite('correct_claws_transparent.png', img)
print("Saved correct_claws_transparent.png")
