import cv2
import numpy as np

img = cv2.imread('correct_claws_bg.png', cv2.IMREAD_UNCHANGED)

# The image is 200x200 or so. Let's just create a blank image, 
# draw 3 diagonal teal lines, and overlay the original tips on top.
h, w = img.shape[:2]

bg = np.zeros((h, w, 4), dtype=np.uint8)

teal = (195, 172, 10, 255) # BGR for teal? Wait, teal is mostly Green and Blue.
# Let's extract the exact teal color from the top left claw
non_zero = np.where(img[:,:,3] > 0)
exact_teal = img[non_zero[0][0], non_zero[1][0]]
teal_color = (int(exact_teal[0]), int(exact_teal[1]), int(exact_teal[2]), 255)

# The angle is roughly -45 degrees. Let's just draw 3 thick lines.
# We can find the center of mass of the top and bottom blobs.
# Or just use a very simple approach: dilate the image diagonally!
# A diagonal kernel from top-left to bottom-right.
kernel_size = 40
kernel = np.zeros((kernel_size, kernel_size), dtype=np.uint8)
for i in range(kernel_size):
    # Diagonal from top-left to bottom-right
    kernel[i, i] = 1
    # add some thickness
    if i+1 < kernel_size: kernel[i, i+1] = 1
    if i-1 >= 0: kernel[i, i-1] = 1

# We can just dilate the alpha channel
alpha = img[:,:,3]
dilated_alpha = cv2.dilate(alpha, kernel, iterations=3)

# Now fill the new alpha pixels with the teal color
filled_img = np.zeros((h, w, 4), dtype=np.uint8)
filled_img[dilated_alpha > 0] = teal_color

# Overlay the original on top (to keep the exact edges of the tips)
for c in range(3):
    filled_img[:,:,c] = np.where(img[:,:,3] > 0, img[:,:,c], filled_img[:,:,c])
filled_img[:,:,3] = np.where(img[:,:,3] > 0, img[:,:,3], filled_img[:,:,3])

cv2.imwrite('continuous_claws.png', filled_img)
print("Saved continuous_claws.png")
