from PIL import Image
img = Image.open("public/images/course/mod2_pg5.png")
width, height = img.size
pixels = img.load()

# The boxes are drawn on the image. Let's sample a vertical line at x = width // 2 (middle of the box)
x = width // 2
edges = []
for y in range(0, height):
    r,g,b = pixels[x, y][:3]
    # The background is dark. The borders are bright.
    if max(r,g,b) > 80:
        edges.append(y)

# group edges into regions
regions = []
if edges:
    cur = [edges[0]]
    for e in edges[1:]:
        if e - cur[-1] > 10: # gap of more than 10px means new region
            regions.append(cur)
            cur = [e]
        else:
            cur.append(e)
    regions.append(cur)

print(f"Total height: {height}")
for r in regions:
    mid = sum(r) / len(r)
    print(f"Bright region at y={mid:.1f}, %={mid/height*100:.2f}")

