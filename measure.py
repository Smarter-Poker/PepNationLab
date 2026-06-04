from PIL import Image
import numpy as np

img = Image.open('public/researcher-menu.jpg').convert('L')
arr = np.array(img)
h, w = arr.shape

row_means = arr.mean(axis=1)

# find local minima (darkest rows)
minima = []
for y in range(30, h-30):
    if row_means[y] < 20 and row_means[y] < row_means[y-1] and row_means[y] < row_means[y+1]:
        minima.append((y, row_means[y]))

print("Minima:", sorted(minima, key=lambda x: x[0]))
