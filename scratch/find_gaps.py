from PIL import Image
import numpy as np

img = Image.open('public/images/store_discovery_hero_v3.png').convert('L')
arr = np.array(img)

# Card row y range is roughly 300 to 480
# Let's sum the pixels horizontally in the y-range of 320 to 440 to find the gaps
y_start, y_end = 320, 440
slice_arr = arr[y_start:y_end, :]

# Compute column averages
col_avgs = np.mean(slice_arr, axis=0)

# The gaps are dark vertical lines. Let's find the valleys in the col_avgs
# We expect 8 gaps between 9 cards, plus the left and right outer margins.
# Let's print the local minima (valleys)
import scipy.signal

# A simple valley finder: look for x where col_avgs[x] is a local minimum
valleys = []
for x in range(15, 1010):
    if col_avgs[x] < 30: # Gaps are very dark
        if col_avgs[x] == min(col_avgs[x-10:x+11]):
            valleys.append(x)

print("Detected valley (gap center candidate) columns:")
print(valleys)

# Let's also print the average brightness every 5 pixels from x=0 to 1024
# to see the peaks and valleys manually
print("\nProfile of column brightness:")
for i in range(0, 1024, 10):
    chunk = col_avgs[i:i+10]
    avg_val = int(np.mean(chunk))
    print(f"x={i:03d}-{i+9:03d}: {avg_val}")
