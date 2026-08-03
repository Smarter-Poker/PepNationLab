import cv2
import numpy as np

img = cv2.imread('template.png')
h, w, _ = img.shape

# The logo and everything is centered.
# We want to blank out ONLY the text "10MG" on both sides, and "EPITHALON".
# We want to KEEP the cyan claws behind them.

# First, let's create a blank image
blank = np.zeros((h, w, 3), dtype=np.uint8)

# The cyan claws are everywhere. Let's extract ALL cyan pixels.
hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
lower_cyan = np.array([80, 100, 100])
upper_cyan = np.array([100, 255, 255])
mask = cv2.inRange(hsv, lower_cyan, upper_cyan)

cyan_pixels = cv2.bitwise_and(img, img, mask=mask)
blank = cv2.add(blank, cyan_pixels)

# Now, we want to copy the "SAVAGE BRANDS" logo from the original image.
# We know the logo is in the top center. It's safe to assume x between 250 and 774, and y from 0 to 220.
# Let's verify by just copying that block exactly.
blank[0:220, 250:774] = img[0:220, 250:774]

# What about the bottom banner "FOR RESEARCH USE ONLY"?
# Let's copy the bottom 60 pixels.
blank[h-60:h, 0:w] = img[h-60:h, 0:w]

# Now, what's left? 
# The left and right side cyan claws are on the blank image!
# But wait, there are holes where the white "10MG" text used to be, because the cyan mask didn't catch the white text.
# The holes might be noticeable. Can we inpaint the holes?
# We can create a mask of the text.
# The text is bright white/grey.
# Alternatively, since the holes will be covered by the new generated text "10MG" or "5MG" in puppeteer, maybe the holes don't matter?
# But if the new text is smaller, the holes will show.

# Let's just output this blank template to see what it looks like.
cv2.imwrite('perfect_blank.png', blank)
print("Saved perfect_blank.png with cyan claws")
