import cv2
import numpy as np

img = cv2.imread('public/images/sub-agent-dashboard.png', 0)
ret, thresh = cv2.threshold(img, 60, 255, cv2.THRESH_BINARY)
contours, hierarchy = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

boxes = []
for cnt in contours:
    x, y, w, h = cv2.boundingRect(cnt)
    if w > 200 and h > 100:
        boxes.append((x, y, w, h))

boxes = sorted(boxes, key=lambda b: (b[1] // 100, b[0]))
for idx, (x, y, w, h) in enumerate(boxes):
    print(f"Button {idx+1}: x={x}, y={y}, w={w}, h={h}")
