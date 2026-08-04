import cv2
import numpy as np

# Load transparent claws
img = cv2.imread('correct_claws_transparent.png', cv2.IMREAD_UNCHANGED)

# Target color: RGB(1, 197, 221) -> BGR(221, 197, 1)
target_b, target_g, target_r = 221, 197, 1

# Convert target to HSV
target_hsv = cv2.cvtColor(np.uint8([[[target_b, target_g, target_r]]]), cv2.COLOR_BGR2HSV)[0][0]
target_h = target_hsv[0]
target_s = target_hsv[1]

# Extract color channels and alpha
bgr = img[:, :, 0:3]
alpha = img[:, :, 3]

# Convert BGR to HSV
hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)

# Modify Hue and Saturation for pixels that have some color (not black)
mask = alpha > 0
hsv[mask, 0] = target_h
hsv[mask, 1] = target_s

# The original claws were darker. Let's scale up the Value (brightness) to match the bright logo claws
# The target value is roughly 221 (the max channel of BGR).
# Let's just boost the V channel by 1.5x (cap at 255) to make it brighter and pop more.
v_channel = hsv[:, :, 2].astype(np.float32)
v_channel[mask] = np.clip(v_channel[mask] * 1.5, 0, 255)
hsv[:, :, 2] = v_channel.astype(np.uint8)

# Convert back to BGR
bgr_new = cv2.cvtColor(hsv, cv2.COLOR_HSV2BGR)

# Combine with alpha
img_new = np.dstack((bgr_new, alpha))

cv2.imwrite('correct_claws_cyan.png', img_new)
print("Saved correct_claws_cyan.png")
