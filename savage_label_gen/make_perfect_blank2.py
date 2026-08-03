import cv2
import numpy as np

img = cv2.imread('true_blank.png', cv2.IMREAD_UNCHANGED)

# Get the exact teal color from the bottom bar
teal_color = img[450, 10].tolist()

# Erase the left and right badge areas completely (y=82 to 420)
bg_color = (0, 0, 0, 255) if img.shape[2] == 4 else (0, 0, 0)
cv2.rectangle(img, (0, 82), (300, 420), bg_color, -1)
cv2.rectangle(img, (724, 82), (1024, 420), bg_color, -1)

# Erase the title area (y=320 to 420 across the whole width)
cv2.rectangle(img, (0, 315), (1024, 420), bg_color, -1)

# Erase the bottom text area (y=422 to 512 across the whole width)
# We fill it with the teal color
cv2.rectangle(img, (0, 422), (1024, 512), tuple(teal_color), -1)

cv2.imwrite('true_perfect_blank2.png', img)
print("Saved true_perfect_blank2.png")
