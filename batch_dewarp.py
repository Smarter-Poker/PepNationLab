import cv2
import numpy as np
import glob
import os

input_dir = "public/images/savage-brands"
output_dir = "public/images/savage-brands-flattened"
os.makedirs(output_dir, exist_ok=True)

# Parameters for dewarping a 1024x1024 image
# The vial is in the center. 
r = 275  # Approximate radius of the cylinder in pixels
cx = 512 # Center X
# The label is roughly from Y=110 to Y=850
top_y = 105
bottom_y = 860

# We want the flat image to cover the front 180 degrees (-pi/2 to pi/2)
# But extreme edges are highly compressed. Let's map -1.2 to 1.2 radians.
max_theta = 1.15
flat_w = int(r * max_theta * 2)
flat_h = bottom_y - top_y

files = glob.glob(os.path.join(input_dir, "*.jpg"))
for filepath in files:
    filename = os.path.basename(filepath)
    out_filepath = os.path.join(output_dir, filename.replace('.jpg', '.png'))
    
    img = cv2.imread(filepath)
    if img is None: continue
    h, w = img.shape[:2]
    
    flat_img = np.zeros((flat_h, flat_w, 3), dtype=np.uint8)
    
    for u in range(flat_w):
        # theta from -max_theta to max_theta
        theta = (u / flat_w - 0.5) * 2 * max_theta
        orig_x = int(cx + r * np.sin(theta))
        
        # calculate curve offset for perspective
        # cylinder curves up at the top and bottom if camera is dead center.
        # usually camera is slightly above center, so top curves less than bottom.
        # Let's approximate a uniform slight curve.
        curve = (r - r * np.cos(theta)) * 0.1
        
        for v in range(flat_h):
            orig_y = int(v + top_y - curve)
            if 0 <= orig_x < w and 0 <= orig_y < h:
                flat_img[v, u] = img[orig_y, orig_x]
                
    cv2.imwrite(out_filepath, flat_img)
    print(f"Processed {filename}")

