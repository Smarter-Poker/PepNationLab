from PIL import Image, ImageDraw
import sys

def remove_background(input_path, output_path):
    img = Image.open(input_path).convert("RGBA")
    data = img.load()
    width, height = img.size
    
    # We will do a simple flood fill from the 4 corners.
    # We treat anything close to black as background.
    threshold = 20
    
    def is_bg(r, g, b, a):
        return r < threshold and g < threshold and b < threshold
    
    visited = set()
    stack = [(0,0), (width-1, 0), (0, height-1), (width-1, height-1)]
    
    while stack:
        x, y = stack.pop()
        if (x, y) in visited:
            continue
        if x < 0 or x >= width or y < 0 or y >= height:
            continue
            
        visited.add((x, y))
        r, g, b, a = data[x, y]
        
        if is_bg(r, g, b, a):
            data[x, y] = (0, 0, 0, 0)
            stack.append((x+1, y))
            stack.append((x-1, y))
            stack.append((x, y+1))
            stack.append((x, y-1))

    img.save(output_path, "PNG")
    print(f"Saved to {output_path}")

remove_background(sys.argv[1], sys.argv[2])
