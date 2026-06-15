from PIL import Image, ImageDraw

def draw_boxes(img_path, out_path, top_pcts, height_pct=4.0):
    img = Image.open(img_path)
    draw = ImageDraw.Draw(img)
    width, height = img.size
    for t in top_pcts:
        y1 = height * t / 100.0
        y2 = height * (t + height_pct) / 100.0
        x1 = width * 0.05
        x2 = width * 0.95
        draw.rectangle([x1, y1, x2, y2], outline="red", width=3)
    img.save(out_path)
    print(f"Saved {out_path}")

draw_boxes("public/images/course/mod4_pg5.png", "public/images/course/mod4_test.png", [29.5, 34.0, 38.5, 52.5, 57.0, 61.5])
draw_boxes("public/images/course/mod5_pg5.png", "public/images/course/mod5_test.png", [26.5, 31.0, 35.5, 51.5, 56.5, 61.0])
draw_boxes("public/images/course/mod4_pg5.png", "public/images/course/mod4_test_exact.png", [27.6, 32.4, 37.1, 54.4, 59.2, 64.0])
