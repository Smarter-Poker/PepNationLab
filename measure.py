import cv2
import numpy as np

img = cv2.imread('public/images/store_discovery_hero.png')
gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

# Threshold to find bright silver borders
_, thresh = cv2.threshold(gray, 180, 255, cv2.THRESH_BINARY)

# Find contours
contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

boxes = []
for cnt in contours:
    x, y, w, h = cv2.boundingRect(cnt)
    if w > 50 and h > 20: # filter out noise
        boxes.append((x, y, w, h))

# Sort by Y, then X
boxes.sort(key=lambda b: (b[1]//50, b[0]))

for b in boxes:
    x, y, w, h = b
    print(f"Box: x={x}, y={y}, w={w}, h={h} | center=({x+w//2}, {y+h//2}) | pct: top={y/582:.1%}, left={x/1024:.1%}, w={w/1024:.1%}, h={h/582:.1%}")
