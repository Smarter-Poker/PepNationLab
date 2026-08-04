import cv2
import numpy as np

img = cv2.imread('true_perfect_blank3.png')
# Search for non-black pixels in the right side area
for y in range(80, 270):
    for x in range(700, 810):
        b, g, r = img[y, x]
        if max(r, g, b) > 50:
            print(f"Found non-black pixel at x={x}, y={y}: R={r} G={g} B={b}")
