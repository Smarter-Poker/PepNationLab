from PIL import Image, ImageDraw

img = Image.open('public/images/agent-dashboard-16.png').convert("RGBA")
draw = ImageDraw.Draw(img)
W, H = img.size

boxes = {}
rows = 8
cols = 2
margin_top = 0.03
margin_bottom = 0.03
margin_left = 0.05
margin_right = 0.05
gap_x = 0.02
gap_y = 0.015

w = (1.0 - margin_left - margin_right - gap_x) / 2
h = (1.0 - margin_top - margin_bottom - gap_y * 7) / 8

for r in range(rows):
    for c in range(cols):
        l = margin_left + c * (w + gap_x)
        t = margin_top + r * (h + gap_y)
        r_box = l + w
        b_box = t + h
        boxes[f"R{r}_C{c}"] = [l, t, r_box, b_box]

for name, (l, t, r, b) in boxes.items():
    x0, y0 = int(l*W), int(t*H)
    x1, y1 = int(r*W), int(b*H)
    draw.rectangle([x0, y0, x1, y1], outline="red", width=5)

img.save('public/images/agent-dashboard-16_test.png')
print("Saved to public/images/agent-dashboard-16_test.png")
