import cv2
import numpy as np
import sys

# Load the original base image
img = cv2.imread('/Users/smarter.poker/.gemini/antigravity/brain/5704cc86-3c79-46da-8052-0defc4900d3b/.user_uploaded/media_1785782206259.png')
if img is None:
    print("Could not load base image")
    sys.exit(1)

# Extract a block of texture from the letter 'S' in SAVAGE (around x=280 to 320, y=200 to 240)
texture = img[180:250, 300:370]

# Enhance contrast of the texture slightly
texture_hsv = cv2.cvtColor(texture, cv2.COLOR_BGR2HSV)
texture_hsv[:,:,2] = cv2.equalizeHist(texture_hsv[:,:,2])
enhanced_texture = cv2.cvtColor(texture_hsv, cv2.COLOR_HSV2BGR)

cv2.imwrite('texture.png', texture)
print("Saved texture.png")

# Now let's extract the claws that are specifically in the 10MG badge from the NEW image the user sent.
# Wait, the user's new image has the claws behind the 10MG.
# Let's just use the left_claws.png we already have, but maybe scale them and rotate them to match what the user did.
