import cv2
import numpy as np

img = cv2.imread('correct_claws_bg.png', cv2.IMREAD_UNCHANGED)
h, w = img.shape[:2]

# Split into top and bottom halves
mid_y = h // 2
top_half = img[:mid_y, :, 3].copy()
bottom_half = img[mid_y:, :, 3].copy()

# Find contours in top half
contours_top, _ = cv2.findContours(top_half, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
contours_top = sorted(contours_top, key=lambda c: cv2.boundingRect(c)[0])

# Find contours in bottom half
contours_bottom, _ = cv2.findContours(bottom_half, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
contours_bottom = sorted(contours_bottom, key=lambda c: cv2.boundingRect(c)[0])

if len(contours_top) >= 3 and len(contours_bottom) >= 3:
    filled_img = np.zeros((h, w, 4), dtype=np.uint8)
    teal = (127, 107, 0, 255) # Approx BGR for teal from the image, but let's extract it:
    non_zero = np.where(img[:,:,3] > 0)
    teal = img[non_zero[0][0], non_zero[1][0]]
    teal_color = (int(teal[0]), int(teal[1]), int(teal[2]), 255)

    for i in range(3):
        ct = contours_top[i]
        cb = contours_bottom[i]
        
        # Get bounding boxes to find the connecting points
        xt, yt, wt, ht = cv2.boundingRect(ct)
        xb, yb, wb, hb = cv2.boundingRect(cb)
        
        # Approximate the connecting polygon
        # Top-left of top contour, top-right of top contour, bottom-right of bottom contour, bottom-left of bottom contour
        pts = np.array([
            [xt, yt],
            [xt + wt, yt],
            [xb + wb, mid_y + yb + hb],
            [xb, mid_y + yb + hb]
        ], np.int32)
        pts = pts.reshape((-1, 1, 2))
        cv2.fillPoly(filled_img, [pts], teal_color)
    
    # Overlay the original image to keep the exact tips
    for c in range(3):
        filled_img[:,:,c] = np.where(img[:,:,3] > 0, img[:,:,c], filled_img[:,:,c])
    filled_img[:,:,3] = np.where(img[:,:,3] > 0, img[:,:,3], filled_img[:,:,3])
    
    cv2.imwrite('perfect_claws.png', filled_img)
    print("Saved perfect_claws.png")
else:
    print(f"Error: found {len(contours_top)} top and {len(contours_bottom)} bottom contours.")
