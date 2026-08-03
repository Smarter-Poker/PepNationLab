import cv2
import numpy as np

img = cv2.imread('true_blank.png', cv2.IMREAD_UNCHANGED)

# Let's save a crop of the logo area to see where it ends
crop = img[0:400, 200:824]
cv2.imwrite('logo_crop.png', crop)

# Print out some stats
print("Saved logo_crop.png")
