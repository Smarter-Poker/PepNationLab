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

text_y = 803
x = 512

# Draw white outline (stroke)
outline_width = 2
outline_color = (255, 255, 255, 255)
for dx in range(-outline_width, outline_width + 1):
    for dy in range(-outline_width, outline_width + 1):
        if dx*dx + dy*dy <= outline_width*outline_width + 1:
            draw.text((x - text_w // 2 + dx, text_y - text_h // 2 + dy), text, fill=outline_color, font=font)

# Draw black text
draw.text((x - text_w // 2, text_y - text_h // 2), text, fill=(0,0,0,255), font=font)

img.convert("RGB").save("/Users/smarter.poker/.gemini/antigravity/brain/d42895c7-f522-47b1-87f7-86eaa6f77a14/preview_images/l-carnitine-blend_outline.png")
print("Done")
