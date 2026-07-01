from PIL import Image

def scan(img_path, x):
    img = Image.open(img_path)
    pixels = img.load()
    print(f"--- {img_path} (x={x}) ---")
    for y in range(750, 850, 5):
        print(f"y={y}: {pixels[x, y]}")

scan("public/images/products/wolverine-stack.png", 714)
scan("public/images/products/cjc-1295-ipa.png", 512)
