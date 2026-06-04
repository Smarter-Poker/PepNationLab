from PIL import Image, ImageDraw

img = Image.open('public/images/research/store-hero.png').convert("RGBA")
draw = ImageDraw.Draw(img)
W, H = img.size

# Guesses (Left, Top, Right, Bottom) as percentages
boxes = {
    'Search': [0.06, 0.13, 0.94, 0.18],
    'Goal_1': [0.05, 0.23, 0.26, 0.41],
    'Goal_2': [0.27, 0.23, 0.49, 0.41],
    'Goal_3': [0.50, 0.23, 0.72, 0.41],
    'Goal_4': [0.73, 0.23, 0.95, 0.41],
    
    'Goal_5': [0.05, 0.42, 0.26, 0.61],
    'Goal_6': [0.27, 0.42, 0.49, 0.61],
    'Goal_7': [0.50, 0.42, 0.72, 0.61],
    'Goal_8': [0.73, 0.42, 0.95, 0.61],
    
    'AlreadyKnow': [0.03, 0.645, 0.97, 0.77],
    
    'MatchMe': [0.15, 0.85, 0.48, 0.93],
    'GuideYou': [0.52, 0.85, 0.85, 0.93],
}

for name, (l, t, r, b) in boxes.items():
    x0, y0 = int(l*W), int(t*H)
    x1, y1 = int(r*W), int(b*H)
    draw.rectangle([x0, y0, x1, y1], outline="lime", width=5)

img.save('public/images/research/boxes_test_2.png')
print("Saved to boxes_test_2.png")
