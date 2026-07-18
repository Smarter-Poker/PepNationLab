from PIL import Image

def remove_solid_background(image_path, output_path, tolerance=15):
    img = Image.open(image_path).convert("RGBA")
    data = img.getdata()
    
    # Get top-left pixel as background color
    bg_color = data[0]
    
    new_data = []
    for item in data:
        # Check if color is within tolerance
        if abs(item[0] - bg_color[0]) <= tolerance and \
           abs(item[1] - bg_color[1]) <= tolerance and \
           abs(item[2] - bg_color[2]) <= tolerance:
            new_data.append((255, 255, 255, 0)) # transparent
        else:
            new_data.append(item)
            
    img.putdata(new_data)
    
    # Now crop to bounding box
    bbox = img.getbbox()
    if bbox:
        img = img.crop(bbox)
        
    img.save(output_path, "PNG")
    print(f"Saved to {output_path}. Size: {img.size}")

remove_solid_background('/Users/smarter.poker/.gemini/antigravity/brain/36b8d1d7-0e6d-4948-90a7-33f2114fbcf5/.user_uploaded/media__1784384384324.png', '/Users/smarter.poker/Documents/pepnationlab/public/images/coa-button.png')
