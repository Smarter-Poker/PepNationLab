from PIL import Image
import os

images = [
    'public/images/store_discovery_hero.png',
    'public/images/store_discovery_hero_v2.png',
    'public/images/store_discovery_hero_v3.png'
]

for img_path in images:
    if not os.path.exists(img_path):
        print(f"{img_path}: DOES NOT EXIST")
        continue
    
    img = Image.open(img_path)
    w, h = img.size
    
    # Check silver cols at y=h*0.8 (bottom half)
    y_test = int(h * 0.8)
    silver_cols = []
    for x in range(w):
        p = img.getpixel((x, y_test))
        r, g, b = p[0], p[1], p[2]
        brightness = (r + g + b) / 3
        if brightness > 100 and abs(r-g) < 15 and abs(g-b) < 15:
            silver_cols.append(x)
            
    ranges = []
    if silver_cols:
        start = silver_cols[0]
        prev = silver_cols[0]
        for x in silver_cols[1:]:
            if x - prev > 10:
                ranges.append((start, prev))
                start = x
            prev = x
        ranges.append((start, prev))
        
    print(f"\n{img_path}: {w}x{h}, y_test={y_test}")
    print(f"Number of silver boundaries: {len(ranges)}")
    for idx, r in enumerate(ranges):
         print(f"  Boundary {idx+1}: x={r[0]}..{r[1]} ({r[0]/w*100:.1f}%..{r[1]/w*100:.1f}%)")
