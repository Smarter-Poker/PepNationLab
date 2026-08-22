import cv2
import numpy as np

img = cv2.imread('true_blank.png', cv2.IMREAD_UNCHANGED)

# Black out the entire left and right regions where the badges go
# to remove ANY old claw marks or smudges.
# We keep the center where the Savage Brands logo is.
# The black area is approx y=80 to y=422.

# Draw a pure black rectangle over the left badge area
# We use the exact black color from the background to make it seamless
# Or just (0, 0, 0, 255)
bg_color = (0, 0, 0, 255) if img.shape[2] == 4 else (0, 0, 0)

# We want to be careful not to overwrite the teal bars. 
# Let's say y from 82 to 420.
cv2.rectangle(img, (0, 82), (280, 420), bg_color, -1)
cv2.rectangle(img, (744, 82), (1024, 420), bg_color, -1)

cv2.imwrite('true_perfect_blank.png', img)
print("Saved true_perfect_blank.png")
