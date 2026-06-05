from PIL import Image

img = Image.open('public/images/store_discovery_hero_v3.png')
# Let's sample a few pixels at the top-left corner
pixels = []
for x in [5, 10, 20]:
    for y in [5, 10, 20]:
        pixels.append(img.getpixel((x, y)))

print("Top-left pixel colors:")
print(pixels)

# Let's get the average color of the top edge
r_sum, g_sum, b_sum = 0, 0, 0
count = 0
for x in range(0, img.width, 10):
    for y in range(0, 10):
        pixel = img.getpixel((x, y))
        r_sum += pixel[0]
        g_sum += pixel[1]
        b_sum += pixel[2]
        count += 1

avg_color = (r_sum // count, g_sum // count, b_sum // count)
print(f"Average color: #{avg_color[0]:02x}{avg_color[1]:02x}{avg_color[2]:02x} {avg_color}")
