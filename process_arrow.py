from PIL import Image
import numpy as np

img = Image.open("/Users/smarter.poker/.gemini/antigravity/brain/7eb1d77e-916d-4c99-a0f8-92bc156a7af3/media__1780186816950.jpg").convert("RGBA")
data = np.array(img)

# The background is very dark. 
# We'll set alpha to 0 for pixels where all of R, G, B are less than a threshold.
r, g, b, a = data.T
threshold = 30
black_areas = (r < threshold) & (g < threshold) & (b < threshold)
data[..., 3][black_areas.T] = 0

img2 = Image.fromarray(data)
# Also let's crop the transparent edges to get just the arrow
bbox = img2.getbbox()
if bbox:
    img2 = img2.crop(bbox)

# Save to public/images/back-arrow.png
img2.save("public/images/back-arrow.png")
print("Saved back-arrow.png")
