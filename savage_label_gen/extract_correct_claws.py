import cv2
import numpy as np

img = cv2.imread('/Users/smarter.poker/.gemini/antigravity/brain/5704cc86-3c79-46da-8052-0defc4900d3b/.user_uploaded/media_1785785725246.png')

hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
lower_cyan = np.array([80, 100, 100])
upper_cyan = np.array([100, 255, 255])
mask = cv2.inRange(hsv, lower_cyan, upper_cyan)

claws_bgra = np.zeros((img.shape[0], img.shape[1], 4), dtype=np.uint8)
for c in range(3):
    claws_bgra[:, :, c] = np.where(mask > 0, img[:, :, c], 0)
claws_bgra[:, :, 3] = np.where(mask > 0, 255, 0)

cv2.imwrite('correct_claws_bg.png', claws_bgra)
print("Saved correct_claws_bg.png")
