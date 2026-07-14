import cv2
import numpy as np

img = cv2.imread("public/images/savage-brands/5-amino-1mq-50mg.jpg")
h, w = img.shape[:2]
cx = w // 2

# We want to find the top and bottom of the label.
# The vial image is 1024x1024.
# Let's print out the color of every 10th pixel from y=100 to y=900
for y in range(100, 900, 10):
    b, g, r = img[y, cx]
    print(f"y={y:3d}: R={r:3d} G={g:3d} B={b:3d}")
