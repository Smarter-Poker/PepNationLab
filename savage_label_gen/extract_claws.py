import cv2
import numpy as np

img = cv2.imread('template.png')

# The left claws are around x=0 to 230, y=180 to 330.
# We want to extract ONLY the cyan pixels from this area.
hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
lower_cyan = np.array([80, 100, 100])
upper_cyan = np.array([100, 255, 255])
mask = cv2.inRange(hsv, lower_cyan, upper_cyan)

# We want an image with transparent background, containing only the cyan claws.
claws_bgra = np.zeros((img.shape[0], img.shape[1], 4), dtype=np.uint8)

# Copy the BGR channels where mask is valid
for c in range(3):
    claws_bgra[:, :, c] = np.where(mask == 255, img[:, :, c], 0)
    
# Set alpha channel to 255 where mask is valid
claws_bgra[:, :, 3] = np.where(mask == 255, 255, 0)

# Now crop just the left claw area.
left_claws = claws_bgra[140:350, 0:240]
cv2.imwrite('left_claws.png', left_claws)

# We can also do the right claws, but we can just use the left claws and flip them horizontally if needed, 
# or just extract the right claws too.
right_claws = claws_bgra[140:350, 1024-240:1024]
cv2.imwrite('right_claws.png', right_claws)

# Let's also create a TRULY blank base image (NO side claws).
# We take perfect_blank.png, and paint black over the left and right claw areas.
perfect_blank = cv2.imread('perfect_blank.png')
# paint black on left
perfect_blank[140:350, 0:240] = (0, 0, 0)
# paint black on right
perfect_blank[140:350, 1024-240:1024] = (0, 0, 0)
cv2.imwrite('true_blank.png', perfect_blank)
print("Saved left_claws.png, right_claws.png, and true_blank.png")
