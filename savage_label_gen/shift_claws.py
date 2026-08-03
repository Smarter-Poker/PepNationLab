import cv2
import numpy as np

img = cv2.imread('correct_claws_bg.png', cv2.IMREAD_UNCHANGED)
h, w = img.shape[:2]

mid_y = h // 2

# We want to move the bottom half UP by 25 pixels to close the gap behind the text
shift = 25
new_img = np.zeros((h, w, 4), dtype=np.uint8)

# Copy top half as is
new_img[:mid_y, :] = img[:mid_y, :]

# Copy bottom half shifted up
new_img[mid_y - shift:h - shift, :] = np.where(
    img[mid_y:, :, 3:4] > 0, 
    img[mid_y:, :], 
    new_img[mid_y - shift:h - shift, :]
)

cv2.imwrite('shifted_claws.png', new_img)
print("Saved shifted_claws.png")
