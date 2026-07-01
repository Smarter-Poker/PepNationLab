from PIL import Image, ImageDraw, ImageFont
import os

img_path = "public/images/products/l-carnitine-blend.png"
os.system(f"git checkout 1d9c152b -- {img_path}")
img = Image.open(img_path).convert("RGBA")
draw = ImageDraw.Draw(img)

font_path = "/System/Library/Fonts/Supplemental/Arial Narrow Bold.ttf"
font = ImageFont.truetype(font_path, 18)
text = "For Research Use Only"
bbox = draw.textbbox((0, 0), text, font=font)
text_w = bbox[2] - bbox[0]
text_h = bbox[3] - bbox[1]

# Draw a white box with rounded corners that covers the bottom of the logo and top of band
# We'll put it at y=803 (centered on the gap)
text_y = 803
pad_x = 10
pad_y = 4

box_x1 = 512 - text_w // 2 - pad_x
box_y1 = text_y - text_h // 2 - pad_y
box_x2 = 512 + text_w // 2 + pad_x
box_y2 = text_y + text_h // 2 + pad_y

draw.rounded_rectangle((box_x1, box_y1, box_x2, box_y2), radius=5, fill=(255, 255, 255, 255))
draw.text((512 - text_w // 2, text_y - text_h // 2), text, fill=(0,0,0,255), font=font)

img.convert("RGB").save("/Users/smarter.poker/.gemini/antigravity/brain/d42895c7-f522-47b1-87f7-86eaa6f77a14/preview_images/l-carnitine-blend_box.png")
print("Done")
