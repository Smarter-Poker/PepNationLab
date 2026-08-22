import sys
from PIL import Image

def trim(im):
    bg = Image.new(im.mode, im.size, im.getpixel((0,0)))
    diff = Image.chops.difference(im, bg)
    diff = Image.chops.add(diff, diff, 2.0, -100)
    bbox = diff.getbbox()
    if bbox:
        return im.crop(bbox)
    return im

def main():
    import PIL.ImageChops as chops
    Image.chops = chops
    
    coa_path = '/Users/smarter.poker/.gemini/antigravity/brain/36b8d1d7-0e6d-4948-90a7-33f2114fbcf5/.user_uploaded/media__1784389539577.png'
    add_to_cart_path = '/Users/smarter.poker/Documents/pepnationlab/public/images/add-to-cart-dynamic.png'
    
    coa_img = Image.open(coa_path)
    add_cart = Image.open(add_to_cart_path)
    
    print(f"Original COA size: {coa_img.size}")
    print(f"Add to Cart size: {add_cart.size}")
    
    # Trim transparency from COA
    # Get bounding box of non-transparent pixels
    bbox = coa_img.getbbox()
    print(f"COA bbox (non-transparent): {bbox}")
    
    if bbox:
        cropped_coa = coa_img.crop(bbox)
        print(f"Cropped COA size: {cropped_coa.size}")
        cropped_coa.save('/Users/smarter.poker/Documents/pepnationlab/public/images/coa-button.png')
        print("Saved cropped COA to public/images/coa-button.png")
    
    # Get Add To Cart bbox
    cart_bbox = add_cart.getbbox()
    print(f"Add to Cart bbox: {cart_bbox}")

if __name__ == '__main__':
    main()
