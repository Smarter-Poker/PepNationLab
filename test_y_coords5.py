from PIL import Image

def scan_center(img_path):
    img = Image.open(img_path)
    pixels = img.load()
    width, height = img.size
    print(f"--- {img_path} ---")
    for y in range(750, 850, 5):
        print(f"y={y}: {pixels[width//2, y]}")

scan_center("public/images/products/glow-blend.png")
scan_center("public/images/products/lemon-bottle.png")
