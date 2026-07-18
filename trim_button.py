import sys
from PIL import Image

def main():
    import PIL.ImageChops as chops
    Image.chops = chops
    
    coa_path = '/Users/smarter.poker/.gemini/antigravity/brain/36b8d1d7-0e6d-4948-90a7-33f2114fbcf5/.user_uploaded/media__1784383530345.png'
    
    coa_img = Image.open(coa_path)
    print(f"Original COA size: {coa_img.size}")
    
    bbox = coa_img.getbbox()
    print(f"COA bbox (non-transparent): {bbox}")
    
    if bbox:
        cropped = coa_img.crop(bbox)
        print(f"Cropped COA size: {cropped.size}")
        cropped.save('/Users/smarter.poker/Documents/pepnationlab/public/images/coa-button.png')
        print("Saved cropped COA to public/images/coa-button.png")

if __name__ == '__main__':
    main()
