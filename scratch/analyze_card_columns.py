from PIL import Image
import numpy as np

img = Image.open('public/images/store_discovery_hero_v3.png').convert('L')
arr = np.array(img)

# Card row is roughly from y=290 to y=480
card_row = arr[290:480, :]
# Average intensity of each column
col_avg = np.mean(card_row, axis=0)

# Print columns with significant brightness changes to find boundaries
print("Analyzing column brightness to find cards...")
# Let's group columns into "light" (card) and "dark" (gap) areas
threshold = np.mean(col_avg) * 0.8
is_card = col_avg > threshold

segments = []
in_segment = False
start_idx = 0

for x in range(len(is_card)):
    if is_card[x] and not in_segment:
        start_idx = x
        in_segment = True
    elif not is_card[x] and in_segment:
        segments.append((start_idx, x - 1))
        in_segment = False
if in_segment:
    segments.append((start_idx, len(is_card) - 1))

print(f"Found {len(segments)} segments:")
for idx, (s, e) in enumerate(segments):
    print(f"Segment {idx+1}: start={s}, end={e}, width={e-s+1}")
    
# Let's print the actual column averages around the edges to be extremely precise
# We can print every 10 columns to see the profile
profile = [f"{x}:{int(col_avg[x])}" for x in range(0, 1024, 16)]
print("Brightness Profile (x:avg):")
print(", ".join(profile))
