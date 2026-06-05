from PIL import Image
import os

images = [
    'public/images/store_discovery_hero.png',
    'public/images/store_discovery_hero_v2.png',
    'public/images/store_discovery_hero_v3.png',
    'public/images/research/store-hero.png'
]

for img_path in images:
    if os.path.exists(img_path):
        with Image.open(img_path) as img:
            print(f"{img_path}: {img.size} {img.mode}")
    else:
        print(f"{img_path}: DOES NOT EXIST")
