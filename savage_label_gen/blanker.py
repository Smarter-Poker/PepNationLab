import cv2
import numpy as np

# Read the image
img = cv2.imread('template.png')
if img is None:
    print("Could not read template.png")
    exit(1)

h, w, _ = img.shape
print(f"Image size: {w}x{h}")

# The text "10MG" is on the left and right sides.
# The text "EPITHALON" is in the middle.
# Let's draw black boxes to cover them. 
# We don't want to cover the cyan claw marks entirely, but the text is on top of them.
# The background is solid black, so we can just draw black filled rectangles.

# Since I don't know the exact coordinates, I'll first output the image with some grid lines to see where to draw the black boxes,
# OR I can just guess the coordinates. 
# Let's write a script to find the text bounds. The text is mostly white/grey.
# Alternatively, I can just use a simple HTML/CSS template and load the cyan claws and logo separately!
# Yes, the cyan claws are just repeated.
