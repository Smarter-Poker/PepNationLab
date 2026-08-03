import cv2
import numpy as np

img = cv2.imread('/Users/smarter.poker/.gemini/antigravity/brain/5704cc86-3c79-46da-8052-0defc4900d3b/.user_uploaded/media_1785782206259.png')

hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
lower_cyan = np.array([80, 100, 100])
upper_cyan = np.array([100, 255, 255])
mask = cv2.inRange(hsv, lower_cyan, upper_cyan)

claws_bgra = np.zeros((img.shape[0], img.shape[1], 4), dtype=np.uint8)
for c in range(3):
    claws_bgra[:, :, c] = np.where(mask == 255, img[:, :, c], 0)
claws_bgra[:, :, 3] = np.where(mask == 255, 255, 0)

# The middle claws are behind the "SAVAGE BRANDS" logo.
# They are generally between x=370 and x=650, y=70 to 350
middle_claws = claws_bgra[70:350, 370:650]
cv2.imwrite('middle_claws.png', middle_claws)
print("Saved middle_claws.png")
