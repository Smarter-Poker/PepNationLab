import pytesseract
from PIL import Image

img = Image.open('public/images/sub-agent-dashboard.png')
data = pytesseract.image_to_data(img, output_type=pytesseract.Output.DICT)

for i in range(len(data['text'])):
    text = data['text'][i].strip()
    if text:
        x, y, w, h = data['left'][i], data['top'][i], data['width'][i], data['height'][i]
        print(f"'{text}' at ({x}, {y}, {w}, {h})")
