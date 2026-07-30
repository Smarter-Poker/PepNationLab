import cv2
import numpy as np

# Read image
img = cv2.imread('/Users/smarter.poker/.gemini/antigravity/brain/f43c3319-e873-4aca-a857-f729f4c03c92/.user_uploaded/media__1785425104991.jpg')
if img is None:
    print("Could not read image")
    exit(1)
    
height, width = img.shape[:2]
print(f"Image dimensions: {width}x{height}")

gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

# Threshold to find bright silver lines
_, thresh = cv2.threshold(gray, 100, 255, cv2.THRESH_BINARY)

# Find contours
contours, _ = cv2.findContours(thresh, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE)

boxes = []
for cnt in contours:
    x,y,w,h = cv2.boundingRect(cnt)
    if w > 50 and h > 20 and w < 600 and h < 200:
        boxes.append((x,y,w,h))

# sort by y
boxes.sort(key=lambda b: b[1])
for b in boxes:
    print(f"Box: x={b[0]}, y={b[1]}, w={b[2]}, h={b[3]}")
