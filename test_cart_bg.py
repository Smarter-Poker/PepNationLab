from PIL import Image

def get_visible_bbox(image_path):
    img = Image.open(image_path).convert("RGBA")
    bbox = img.getbbox()
    print(f"Cart Button {image_path} Bounding box: {bbox}")
    
get_visible_bbox('/Users/smarter.poker/Documents/pepnationlab/public/images/add-to-cart-dynamic.png')
