from PIL import Image, ImageDraw

img = Image.open('public/images/research/store-hero.png').convert("RGBA")
draw = ImageDraw.Draw(img)
W, H = img.size

# Guesses (Left, Top, Right, Bottom) as percentages
boxes = {
    'Search': [0.06, 0.13, 0.94, 0.18],
    'Goal_1': [0.05, 0.23, 0.25, 0.40],
    'Goal_2': [0.28, 0.23, 0.48, 0.40],
    'Goal_3': [0.50, 0.23, 0.70, 0.40],
    'Goal_4': [0.73, 0.23, 0.93, 0.40],
    
    'Goal_5': [0.05, 0.42, 0.25, 0.60],
    'Goal_6': [0.28, 0.42, 0.48, 0.60],
    'Goal_7': [0.50, 0.42, 0.70, 0.60],
    'Goal_8': [0.73, 0.42, 0.93, 0.60],
    
    'AlreadyKnow': [0.03, 0.65, 0.97, 0.78],
    
    'MatchMe': [0.15, 0.85, 0.48, 0.94],
    'GuideYou': [0.52, 0.85, 0.85, 0.94],
}

for name, (l, t, r, b) in boxes.items():
    x0, y0 = int(l*W), int(t*H)
    x1, y1 = int(r*W), int(b*H)
    draw.rectangle([x0, y0, x1, y1], outline="red", width=5)

img.save('public/images/research/boxes_test.png')
print("Saved to boxes_test.png")
