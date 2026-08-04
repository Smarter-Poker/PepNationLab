import cv2
import numpy as np

img = cv2.imread('true_blank.png', cv2.IMREAD_UNCHANGED)

bg_color = (0, 0, 0, 255) if img.shape[2] == 4 else (0, 0, 0)
teal_color = img[450, 10].tolist()

# Erase the left and right badge areas completely (y=82 to 420)
# Make sure NOT to overlap the S (starts ~220) and E (ends ~800)
cv2.rectangle(img, (0, 82), (210, 420), bg_color, -1)
cv2.rectangle(img, (810, 82), (1024, 420), bg_color, -1)

# Erase the tiny grey smudge on the right side of the logo
# The smudge is at x=766..773, y=192..212
cv2.rectangle(img, (760, 190), (780, 220), bg_color, -1)

# Erase the title area (y=320 to 420 across the whole width)
# The logo claws end around y=310, so y=320 is safe
cv2.rectangle(img, (0, 320), (1024, 420), bg_color, -1)

# Erase the bottom text area (y=422 to 512 across the whole width)
cv2.rectangle(img, (0, 422), (1024, 512), tuple(teal_color), -1)

cv2.imwrite('true_perfect_blank4.png', img)
print("Saved true_perfect_blank4.png")
