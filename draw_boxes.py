from PIL import Image, ImageDraw
img = Image.open("public/images/course/mod2_pg5.png")
draw = ImageDraw.Draw(img)
width, height = img.size

def draw_opt(top_pct):
    y = height * (top_pct / 100.0)
    x = width * 0.05
    w = width * 0.90
    h = height * 0.045
    draw.rectangle([x, y, x+w, y+h], outline="red", width=3)

# Original values:
draw_opt(27.5)
draw_opt(32.5)
draw_opt(37.5)

draw_opt(54.5)
draw_opt(59.5)
draw_opt(64.5)

img.save("public/images/course/mod2_test_original.png")

img = Image.open("public/images/course/mod2_pg5.png")
draw = ImageDraw.Draw(img)

def draw_opt2(top_pct):
    y = height * (top_pct / 100.0)
    x = width * 0.05
    w = width * 0.90
    h = height * 0.045
    draw.rectangle([x, y, x+w, y+h], outline="green", width=3)

# My new values:
draw_opt2(25.5)
draw_opt2(30.5)
draw_opt2(35.5)

draw_opt2(52.5)
draw_opt2(57.5)
draw_opt2(62.5)

img.save("public/images/course/mod2_test_new.png")
