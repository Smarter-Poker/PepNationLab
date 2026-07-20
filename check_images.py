import os
from PIL import Image

folder = '/Users/smarter.poker/.gemini/antigravity/brain/58a1f4b4-c7a9-4038-a79a-3c02872fed06/.user_uploaded'
for file in os.listdir(folder):
    if file.endswith('.png'):
        path = os.path.join(folder, file)
        with Image.open(path) as img:
            print(f"{file}: {img.size}")
