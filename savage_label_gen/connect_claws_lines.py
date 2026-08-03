import cv2
import numpy as np

img = cv2.imread('correct_claws_bg.png', cv2.IMREAD_UNCHANGED)
h, w = img.shape[:2]

mid_y = h // 2
top_half = img[:mid_y, :, 3].copy()
bottom_half = img[mid_y:, :, 3].copy()

contours_top, _ = cv2.findContours(top_half, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
contours_top = sorted(contours_top, key=lambda c: cv2.boundingRect(c)[0])

contours_bottom, _ = cv2.findContours(bottom_half, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
contours_bottom = sorted(contours_bottom, key=lambda c: cv2.boundingRect(c)[0])

if len(contours_top) >= 3 and len(contours_bottom) >= 3:
    filled_img = np.zeros((h, w, 4), dtype=np.uint8)
    
    non_zero = np.where(img[:,:,3] > 0)
    teal = img[non_zero[0][0], non_zero[1][0]]
    teal_color = (int(teal[0]), int(teal[1]), int(teal[2]), 255)

    for i in range(3):
        ct = contours_top[i]
        cb = contours_bottom[i]
        
        # Find lowest point of top contour
        lowest_pt_top = tuple(ct[ct[:, :, 1].argmax()][0])
        
        # Find highest point of bottom contour
        highest_pt_bottom = tuple(cb[cb[:, :, 1].argmin()][0])
        
        # Adjust bottom point y coordinate
        highest_pt_bottom = (highest_pt_bottom[0], highest_pt_bottom[1] + mid_y)
        
        # Draw a thick line connecting them
        cv2.line(filled_img, lowest_pt_top, highest_pt_bottom, teal_color, thickness=20)
    
    # Overlay the original image
    for c in range(3):
        filled_img[:,:,c] = np.where(img[:,:,3] > 0, img[:,:,c], filled_img[:,:,c])
    filled_img[:,:,3] = np.where(img[:,:,3] > 0, img[:,:,3], filled_img[:,:,3])
    
    cv2.imwrite('line_claws.png', filled_img)
    print("Saved line_claws.png")
else:
    print(f"Error: found {len(contours_top)} top and {len(contours_bottom)} bottom contours.")
