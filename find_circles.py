from PIL import Image

def find_circle_left(img_path, top_pct):
    img = Image.open(img_path)
    width, height = img.size
    pixels = img.load()
    
    y = int(height * (top_pct / 100.0) + height * 0.02) # middle of the box
    
    # scan left to right
    for x in range(int(width * 0.05), width):
        r,g,b = pixels[x, y][:3]
        if max(r,g,b) > 80: # hit the bright circle border
            print(f"{img_path} circle left edge at x={x}, which is {x/width*100:.2f}% of full width.")
            # We want the percentage relative to the option box!
            # The option box starts at 5% width.
            # Its width is 90% (M1, M2) or 44% (M3).
            if "mod3" in img_path:
                rel_left = (x - width * 0.05) / (width * 0.44) * 100
            else:
                rel_left = (x - width * 0.05) / (width * 0.90) * 100
            print(f"Relative left inside option box: {rel_left:.2f}%")
            return

find_circle_left("public/images/course/mod1_pg5.png", 36.5)
find_circle_left("public/images/course/mod2_pg5.png", 27.6)
find_circle_left("public/images/course/mod3_pg5.png", 28.0)

