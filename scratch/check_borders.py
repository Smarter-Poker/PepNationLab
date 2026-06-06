import os
from PIL import Image

badge_dir = "/Users/smarter.poker/Documents/pepnationlab/public/images/badges"
images = [
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

for name in images:
    path = os.path.join(badge_dir, name)
    if not os.path.exists(path):
        continue
    img = Image.open(path)
    width, height = img.size
    
    # Col 0 non-transparent
    col0_non_zero = sum(1 for y in range(height) if img.getpixel((0, y))[3] > 0)
    # Col width-1 non-transparent
    col_last_non_zero = sum(1 for y in range(height) if img.getpixel((width - 1, y))[3] > 0)
    
    print(f"{name:35} {width}x{height} : Col 0: {col0_non_zero}/{height}, Col Last: {col_last_non_zero}/{height}")
