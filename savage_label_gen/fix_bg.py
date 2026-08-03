import cv2
import numpy as np

img = cv2.imread('true_blank.png', cv2.IMREAD_UNCHANGED)
h, w = img.shape[:2]

# The teal bar is at the bottom.
# Let's get the teal color from the top-left of the teal bar.
# Usually it starts around y=410
teal_y = 420
teal_x = 50
teal_color = img[teal_y, teal_x]

# Fill the entire bottom section (y > 410) with this solid teal color
# But the teal bar has a black line above it?
# In true_blank, the teal bar starts exactly where the black ends.
# We'll just overwrite everything where there is currently text. The text is white/grey.
# Easiest way: just draw a solid rectangle over the text area.
# The text is approximately y=420 to y=500.

# Actually, just fill the whole teal bar.
for y in range(410, h):
    # just pick a teal pixel from this row to keep any gradient if it exists,
    # or just use a solid color.
    img[y, :] = img[y, 10] # use the 10th pixel from the left, which has no text

cv2.imwrite('true_blank_fixed.png', img)
print("Saved true_blank_fixed.png")
