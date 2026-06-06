import os
from PIL import Image

badge_dir = "/Users/smarter.poker/Documents/pepnationlab/public/images/badges"

def pad_image(filename):
    path = os.path.join(badge_dir, filename)
    if not os.path.exists(path):
        print(f"Skipping {filename} (not found)")
        return
    img = Image.open(path)
    width, height = img.size
    
    # Calculate padding (e.g., 5% of dimension or a fixed amount)
    pad_w = int(width * 0.08)
    pad_h = int(height * 0.08)
    
    new_width = width + 2 * pad_w
    new_height = height + 2 * pad_h
    
    new_img = Image.new("RGBA", (new_width, new_height), (0, 0, 0, 0))
    new_img.paste(img, (pad_w, pad_h))
    new_img.save(path)
    print(f"Padded {filename}: {width}x{height} -> {new_width}x{new_height}")

# List of images to pad
images_to_pad = [
    "trophy_1st_choice.png",
    "trophy_2nd_choice.png",
    "trophy_3rd_choice.png",
    "trophy_4th.png",
    "badge_research_compound.png",
    "badge_risk_moderate.png",
    "badge_approved_drug.png",
    "badge_investigational_drug.png",
    "badge_preclinical.png",
    "badge_cosmetic.png",
    "badge_stack.png",
    "badge_cold_chain.png",
    "badge_angio_alert.png",
    "badge_glp1.png",
    "badge_top_pick.png",
    "badge_risk_low.png",
    "badge_risk_high.png",
    "badge_risk_critical.png"
]

for name in images_to_pad:
    pad_image(name)
