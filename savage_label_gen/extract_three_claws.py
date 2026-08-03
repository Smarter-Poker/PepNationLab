import cv2
import numpy as np

img = cv2.imread('middle_claws.png', cv2.IMREAD_UNCHANGED)

# middle_claws.png has 4 claws. The leftmost claw is around x=0 to x=60 roughly.
# Let's find the bounding boxes of the 4 claws.
gray = cv2.cvtColor(img, cv2.COLOR_BGRA2GRAY)
_, thresh = cv2.threshold(gray, 10, 255, cv2.THRESH_BINARY)
contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

# Sort contours by x position
contours = sorted(contours, key=lambda c: cv2.boundingRect(c)[0])

if len(contours) >= 4:
    # Keep the rightmost 3 claws
    mask = np.zeros_like(thresh)
    for c in contours[-3:]:
        cv2.drawContours(mask, [c], -1, 255, thickness=cv2.FILLED)
    
    img_3_claws = img.copy()
    img_3_claws[mask == 0] = [0, 0, 0, 0]
    
    # Crop to the bounding box of the 3 claws
    x, y, w, h = cv2.boundingRect(mask)
    img_3_claws_cropped = img_3_claws[y:y+h, x:x+w]
    
    cv2.imwrite('three_claws.png', img_3_claws_cropped)
    print("Saved three_claws.png")
else:
    print(f"Found {len(contours)} contours, expected at least 4.")
