from PIL import Image, ImageDraw
import sys

img = Image.open('public/images/areas_header.png')
draw = ImageDraw.Draw(img)
w, h = img.size

# Link: top 20%, height 30%, left 60%, width 35%
draw.rectangle([(w*0.60, h*0.20), (w*0.95, h*0.50)], outline="red", width=5)

# Search form: top 68%, height 10%, left 4%, width 73%
draw.rectangle([(w*0.04, h*0.68), (w*0.77, h*0.78)], outline="blue", width=5)

# Search button: top 68%, height 10%, left 80%, width 15%
draw.rectangle([(w*0.79, h*0.68), (w*0.94, h*0.78)], outline="green", width=5)

img.save('public/images/test_coords.png')
