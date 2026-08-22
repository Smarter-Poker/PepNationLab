import cv2
import numpy as np

def dewarp_cylinder(image_path, output_path):
    img = cv2.imread(image_path)
    if img is None:
        print(f"Could not read {image_path}")
        return

    h, w = img.shape[:2]
    
    # We will crop the label part. 
    # The vial is centered. 
    # Center X: 512. Radius: roughly 280 pixels.
    # Label top: 250, Label bottom: 850
    cx, cy = w // 2, h // 2
    r = 280
    
    # Flat image width is pi * r / 2 roughly for the front visible part
    # Actually, the visible arc is from -pi/2 to pi/2
    # but the extreme edges are highly compressed. Let's just map from -1.2 to 1.2 radians to avoid extreme edge distortion.
    max_theta = 1.1
    flat_w = int(r * max_theta * 2)
    flat_h = 600 # from 250 to 850
    
    flat_img = np.zeros((flat_h, flat_w, 3), dtype=np.uint8)
    
    for u in range(flat_w):
        theta = (u / flat_w - 0.5) * 2 * max_theta
        orig_x = int(cx + r * np.sin(theta))
        
        # for y, add a slight curve. The cylinder's top and bottom curve up at the edges.
        # offset is r - r * cos(theta). If it's tilted down, the curve is positive.
        curve_offset = int((r - r * np.cos(theta)) * 0.15)
        
        for v in range(flat_h):
            orig_y = int(v + 250 - curve_offset)
            
            if 0 <= orig_x < w and 0 <= orig_y < h:
                flat_img[v, u] = img[orig_y, orig_x]
                
    cv2.imwrite(output_path, flat_img)
    print(f"Saved to {output_path}")

dewarp_cylinder("public/images/savage-brands/5-amino-1mq-50mg.jpg", "public/images/savage-brands-labels-test.jpg")
