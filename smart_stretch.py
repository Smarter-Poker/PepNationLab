from PIL import Image

def smart_stretch_pill(input_path, output_path, target_width=896, target_height=251):
    img = Image.open(input_path).convert("RGBA")
    
    # 1. Scale proportionally to target height
    aspect = img.width / img.height
    new_w = int(target_height * aspect)
    img = img.resize((new_w, target_height), Image.Resampling.LANCZOS)
    
    # 2. Slice into 3 pieces
    # We assume the end caps are roughly half the height in width, let's say 140px
    cap_w = 140
    
    left_cap = img.crop((0, 0, cap_w, target_height))
    right_cap = img.crop((new_w - cap_w, 0, new_w, target_height))
    middle = img.crop((cap_w, 0, new_w - cap_w, target_height))
    
    # 3. Stretch the middle
    target_mid_w = target_width - (cap_w * 2)
    stretched_mid = middle.resize((target_mid_w, target_height), Image.Resampling.LANCZOS)
    
    # 4. Composite
    final_img = Image.new("RGBA", (target_width, target_height))
    final_img.paste(left_cap, (0, 0))
    final_img.paste(stretched_mid, (cap_w, 0))
    final_img.paste(right_cap, (cap_w + target_mid_w, 0))
    
    final_img.save(output_path, "PNG")
    print(f"Saved smart-stretched image to {output_path}. Size: {final_img.size}")

smart_stretch_pill('/Users/smarter.poker/Documents/pepnationlab/public/images/coa-button.png', '/Users/smarter.poker/Documents/pepnationlab/public/images/coa-button.png')
