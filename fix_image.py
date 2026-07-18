from PIL import Image

def main():
    path = '/Users/smarter.poker/Documents/pepnationlab/public/images/coa-button.png'
    img = Image.open(path).convert("RGBA")
    
    # We want it to be 896x251
    target_ratio = 896 / 251
    current_ratio = img.width / img.height
    
    if current_ratio > target_ratio:
        # Too wide, need to add vertical padding
        new_height = int(img.width / target_ratio)
        new_img = Image.new("RGBA", (img.width, new_height), (255, 255, 255, 0))
        new_img.paste(img, (0, (new_height - img.height) // 2))
    else:
        # Too tall, need to add horizontal padding
        new_width = int(img.height * target_ratio)
        new_img = Image.new("RGBA", (new_width, img.height), (255, 255, 255, 0))
        new_img.paste(img, ((new_width - img.width) // 2, 0))
        
    new_img = new_img.resize((896, 251), Image.Resampling.LANCZOS)
    new_img.save(path)
    print(f"Resized COA button to {new_img.size}")

if __name__ == '__main__':
    main()
