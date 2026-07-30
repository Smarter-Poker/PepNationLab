"""
Composites a product vial image into the card background frame.
The card background's V-chrome divider is ALWAYS on top because we:
  1. Open the card background (the frame/chrome layer)
  2. Open the vial image, resize it to fit INSIDE the image window with contain (full vial visible)
  3. Paste the vial INTO the black image-window area of the card
  4. Restore the V-chrome by blending the original card bg back using a lighten operation
     (chrome pixels are brighter than vial background — lighten keeps the brightest = chrome wins)

Usage:
  python3 scripts/make_card.py <vial_image_path> <output_path>

Example:
  python3 scripts/make_card.py public/images/savage-brands/tirzepatide-10mg.jpg \
                               public/images/storefront/tirzepatide-card-composite.jpg
"""

import sys
import numpy as np
from PIL import Image

CARD_BG = "public/images/storefront/premium-card-bg.jpg"

# Image window position on the 683×1024 card (pixels)
WIN_X, WIN_Y = 25, 25
WIN_W, WIN_H = 633, 523   # right edge = 658, bottom edge = 548

def make_card(vial_path: str, out_path: str):
    card = Image.open(CARD_BG).convert("RGB")
    vial = Image.open(vial_path).convert("RGB")

    # --- Step 1: Resize vial to fit the window with contain (show full vial, no crop) ---
    vial_w, vial_h = vial.size
    win_aspect = WIN_W / WIN_H
    vial_aspect = vial_w / vial_h

    if vial_aspect > win_aspect:
        # wider than window → fit to width
        new_w = WIN_W
        new_h = int(new_w / vial_aspect)
    else:
        # taller than window → fit to height
        new_h = WIN_H
        new_w = int(new_h * vial_aspect)

    vial_resized = vial.resize((new_w, new_h), Image.LANCZOS)

    # --- Step 2: Create a black canvas the size of the window, paste vial centered ---
    window_canvas = Image.new("RGB", (WIN_W, WIN_H), (0, 0, 0))
    paste_x = (WIN_W - new_w) // 2
    paste_y = (WIN_H - new_h) // 2
    window_canvas.paste(vial_resized, (paste_x, paste_y))

    # --- Step 3: Paste window canvas into card at the image window position ---
    composite = card.copy()
    composite.paste(window_canvas, (WIN_X, WIN_Y))

    # --- Step 4: Restore the V-chrome using lighten blend ---
    # The chrome in the card bg is bright silver (>120). The black window canvas is dark.
    # Lighten picks the brighter pixel → chrome wins over dark vial background.
    # This brings the V-frame chrome back on top of the pasted vial.
    comp_arr  = np.array(composite,  dtype=np.uint16)
    card_arr  = np.array(card,       dtype=np.uint16)

    # Apply lighten only within the image window + a bit below (chrome region)
    # This avoids the info panel text being lightened
    chrome_y1 = WIN_Y + int(WIN_H * 0.82)   # ~80% down the window = start of V-chrome area
    chrome_y2 = WIN_Y + WIN_H + 40          # a bit below the window bottom

    region_comp = comp_arr[chrome_y1:chrome_y2, WIN_X:WIN_X+WIN_W]
    region_card = card_arr[chrome_y1:chrome_y2, WIN_X:WIN_X+WIN_W]
    comp_arr[chrome_y1:chrome_y2, WIN_X:WIN_X+WIN_W] = np.maximum(region_comp, region_card)

    result = Image.fromarray(comp_arr.astype(np.uint8))
    result.save(out_path, quality=95)
    print(f"✅  Saved → {out_path}")

if __name__ == "__main__":
    if len(sys.argv) != 3:
        print(__doc__)
        sys.exit(1)
    make_card(sys.argv[1], sys.argv[2])
