import cv2
import numpy as np

img = cv2.imread('template.png')
if img is None:
    print("Could not read template.png")
    exit(1)

h, w, _ = img.shape
blank = np.zeros((h, w, 3), dtype=np.uint8)

# The logo is in the top center. Let's assume it's in the top 45% of the image, and center 60%.
# Let's just copy the logo area directly.
logo_y_start = 0
logo_y_end = int(h * 0.45)
logo_x_start = int(w * 0.20)
logo_x_end = int(w * 0.80)

# But wait, the logo might have black background, which is fine since blank is black.
blank[logo_y_start:logo_y_end, logo_x_start:logo_x_end] = img[logo_y_start:logo_y_end, logo_x_start:logo_x_end]

# Now, extract the cyan claw marks. They are roughly cyan in color.
# Convert to HSV to threshold cyan.
hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
# Cyan in HSV: Hue is around 90 (in OpenCV, H is 0-179, so 180/2 = 90).
# Let's say H: 80 to 100, S: 150 to 255, V: 150 to 255
lower_cyan = np.array([80, 100, 100])
upper_cyan = np.array([100, 255, 255])
mask = cv2.inRange(hsv, lower_cyan, upper_cyan)

# Copy the cyan pixels to the blank image
cyan_pixels = cv2.bitwise_and(img, img, mask=mask)

# Add the cyan pixels to the blank image (only where blank is currently black to avoid overwriting logo)
blank_gray = cv2.cvtColor(blank, cv2.COLOR_BGR2GRAY)
_, blank_mask = cv2.threshold(blank_gray, 1, 255, cv2.THRESH_BINARY_INV)

cyan_to_add = cv2.bitwise_and(cyan_pixels, cyan_pixels, mask=blank_mask)
blank = cv2.add(blank, cyan_to_add)

# Now, there's a cyan banner at the bottom.
# "FOR RESEARCH USE ONLY" is on this banner.
# The banner is at the bottom 15% of the image.
# We can just draw a solid cyan rectangle at the bottom!
# Let's find the banner color by looking at the bottom left pixel.
banner_color = img[h-5, 5].tolist() # BGR
banner_h = int(h * 0.18)
# Draw the banner
cv2.rectangle(blank, (0, h - banner_h), (w, h), banner_color, -1)

cv2.imwrite('savage-blank-template.png', blank)
print("Saved savage-blank-template.png")
