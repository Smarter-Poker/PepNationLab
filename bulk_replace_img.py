import os
import re

FILES = [
    "components/Navbar.tsx",
    "components/research/PinToCompareButton.tsx",
    "components/storefront/DynamicAddToCartButton.tsx",
    "components/storefront/DynamicCartButton.tsx",
    "components/storefront/DynamicCompareButton.tsx",
    "components/storefront/DynamicDetailButton.tsx",
    "components/storefront/ProductModalEnhancements.tsx",
    "components/storefront/StorefrontCompareDrawer.tsx",
    "components/storefront/StorefrontDiscovery.tsx"
]

def process_file(filepath):
    if not os.path.exists(filepath):
        print(f"File not found: {filepath}")
        return
        
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Make sure Image from next/image is imported
    if "import Image from" not in content and "import Image " not in content:
        # Add import at the top
        content = re.sub(r'^(import .*?;?\n)', r'\1import Image from "next/image";\n', content, count=1)
        
    # Replace <img src=... /> with <Image src=... width={200} height={200} unoptimized />
    # We will use regex, but handle self-closing tags
    
    # Simple regex to catch `<img ...>` and `<img ... />`
    def img_replacer(match):
        inner = match.group(1)
        # remove any inline width/height or make sure width={200} height={200} unoptimized is added
        # if the tag already has width and height, we just add unoptimized
        if 'width=' not in inner:
            inner += ' width={200} height={200}'
        if 'unoptimized' not in inner:
            inner += ' unoptimized'
        return f'<Image{inner} />'

    new_content = re.sub(r'<img([^>]+?)/?>', img_replacer, content)
    
    if new_content != content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Updated {filepath}")
    else:
        print(f"No changes in {filepath}")

for f in FILES:
    process_file(f)
