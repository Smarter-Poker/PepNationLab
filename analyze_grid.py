import cv2
import numpy as np

img = cv2.imread('public/images/sub-agent-dashboard.png', 0) # Read as grayscale
# Find horizontal edges
edges = cv2.Canny(img, 50, 150)
row_sums = np.sum(edges, axis=1)

# Find peaks in row_sums which correspond to horizontal button edges
peaks = []
for i in range(1, len(row_sums)-1):
    if row_sums[i] > 10000 and row_sums[i] > row_sums[i-1] and row_sums[i] > row_sums[i+1]:
        peaks.append(i)

print(f"Total peaks: {len(peaks)}")
print("Peak rows:", peaks)
