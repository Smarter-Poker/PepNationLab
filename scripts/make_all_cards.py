"""
Batch-generates all PremiumPeptideCard composites for BOTH brands.

For each brand we have a slug→image mapping. The script:
  1. Opens the card background template
  2. Opens the product vial image (contain-scaled into the image window)
  3. Blends using lighten in the V-chrome region so the chrome sits on top
  4. Saves to public/images/storefront/<brand>/<slug>-card.jpg

Usage:
  python3 scripts/make_all_cards.py
"""

import os
import numpy as np
from PIL import Image

CARD_BG    = "public/images/storefront/premium-card-bg.jpg"
WIN_X, WIN_Y = 25, 25
WIN_W, WIN_H = 633, 523

def make_composite(vial_path: str, out_path: str):
    if not os.path.exists(vial_path):
        print(f"  ⚠️  SKIP (image not found): {vial_path}")
        return

    card = Image.open(CARD_BG).convert("RGB")
    vial = Image.open(vial_path).convert("RGB")

    vial_w, vial_h = vial.size
    win_aspect  = WIN_W / WIN_H
    vial_aspect = vial_w / vial_h

    if vial_aspect > win_aspect:
        new_w, new_h = WIN_W, int(WIN_W / vial_aspect)
    else:
        new_h, new_w = WIN_H, int(WIN_H * vial_aspect)

    vial_resized = vial.resize((new_w, new_h), Image.LANCZOS)

    window_canvas = Image.new("RGB", (WIN_W, WIN_H), (0, 0, 0))
    paste_x = (WIN_W - new_w) // 2
    paste_y = (WIN_H - new_h) // 2
    window_canvas.paste(vial_resized, (paste_x, paste_y))

    composite = card.copy()
    composite.paste(window_canvas, (WIN_X, WIN_Y))

    # Restore V-chrome via lighten blend (chrome is brighter than vial bg)
    comp_arr = np.array(composite, dtype=np.uint16)
    card_arr = np.array(card,      dtype=np.uint16)
    y1 = WIN_Y + int(WIN_H * 0.82)
    y2 = WIN_Y + WIN_H + 40
    comp_arr[y1:y2, WIN_X:WIN_X+WIN_W] = np.maximum(
        comp_arr[y1:y2, WIN_X:WIN_X+WIN_W],
        card_arr[y1:y2, WIN_X:WIN_X+WIN_W]
    )

    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    Image.fromarray(comp_arr.astype(np.uint8)).save(out_path, quality=95)
    print(f"  ✅  {out_path}")


# ─────────────────────────────────────────────────────────────────────────────
# SAVAGE BRANDS — slug → image file in public/images/savage-brands/
# ─────────────────────────────────────────────────────────────────────────────
SB_DIR = "public/images/savage-brands"
SAVAGE_MAP = {
    "tirzepatide":        f"{SB_DIR}/tirzepatide-10mg.jpg",
    "retatrutide":        f"{SB_DIR}/retatrutide-10mg.jpg",
    "semaglutide":        f"{SB_DIR}/semaglutide-10mg.jpg",
    "bpc-157":            f"{SB_DIR}/bpc-157-10mg.jpg",
    "tb-500":             f"{SB_DIR}/tb-500-10mg.jpg",
    "cagrilintide":       f"{SB_DIR}/cagrilintide-10mg.jpg",
    "ipamorelin":         f"{SB_DIR}/ipamorelin-10mg.jpg",
    "sermorelin":         f"{SB_DIR}/sermorelin-10mg.jpg",
    "ghrp-2":             f"{SB_DIR}/ghrp2-10mg.jpg",
    "ghrp-6":             f"{SB_DIR}/ghrp6-10mg.jpg",
    "cjc-1295-dac":       f"{SB_DIR}/cjc1295-with-dac-5mg.jpg",
    "cjc-1295-no-dac":    f"{SB_DIR}/cjc1295-without-dac-10mg.jpg",
    "aod-9604":           f"{SB_DIR}/aod9604-10mg.jpg",
    "epithalon":          f"{SB_DIR}/epithalon-10mg.jpg",
    "pt-141":             f"{SB_DIR}/pt141-10mg.jpg",
    "melanotan-ii":       f"{SB_DIR}/mt2-10mg.jpg",
    "melanotan-1":        f"{SB_DIR}/mt-1-10mg.jpg",
    "oxytocin":           f"{SB_DIR}/oxytocin-10mg.jpg",
    "kisspeptin-10":      f"{SB_DIR}/kisspeptin10-10mg.jpg",
    "hexarelin":          f"{SB_DIR}/hexarelin-5mg.jpg",
    "hgh-fragment":       f"{SB_DIR}/hgh-fragment-5mg.jpg",
    "igf-1-lr3":          f"{SB_DIR}/igf1-lr3-1mg.jpg",
    "mots-c":             f"{SB_DIR}/motsc-10mg.jpg",
    "ss-31":              f"{SB_DIR}/ss-31-10mg.jpg",
    "nad-plus":           f"{SB_DIR}/nad-100mg.jpg",
    "glutathione":        f"{SB_DIR}/glutathione-1500mg.jpg",
    "ghk-cu":             f"{SB_DIR}/ghkcu-100mg.jpg",
    "ahk-cu":             f"{SB_DIR}/ahkcu-100mg.jpg",
    "kpv":                f"{SB_DIR}/kpv-10mg.jpg",
    "dsip":               f"{SB_DIR}/dsip-10mg.jpg",
    "selank":             f"{SB_DIR}/selank-5mg.jpg",
    "semax":              f"{SB_DIR}/semax-10mg.jpg",
    "dihexa":             f"{SB_DIR}/dihexa-30mg.jpg",
    "pinealon":           f"{SB_DIR}/pinealon-10mg.jpg",
    "vip":                f"{SB_DIR}/vip-10mg.jpg",
    "ll-37":              f"{SB_DIR}/ll-37-5mg.jpg",
    "snap-8":             f"{SB_DIR}/snap-8-10mg.jpg",
    "ara-290":            f"{SB_DIR}/ara290-10mg.jpg",
    "thymosin-alpha-1":   f"{SB_DIR}/thymosin-alpha-1-10mg.jpg",
    "thymalin":           f"{SB_DIR}/thymalin-10mg.jpg",
    "aicar":              f"{SB_DIR}/aicar-50mg.jpg",
    "foxo4-dri":          f"{SB_DIR}/foxo4dri-10mg.jpg",
    "tesamorelin":        f"{SB_DIR}/tesamorelin-10mg.jpg",
    "survodutide":        f"{SB_DIR}/survodutide-10mg.jpg",
    "hcg":                f"{SB_DIR}/hcg-5000iu.jpg",
    "hmg":                f"{SB_DIR}/hmg-75iu.jpg",
    "melatonin":          f"{SB_DIR}/melatonin-10mg.jpg",
    "bac-water":          f"{SB_DIR}/bac-water.jpg",
    "cerebrolysin":       f"{SB_DIR}/cerebrolysin-60mg.jpg",
    "5-amino-1mq":        f"{SB_DIR}/5-amino-1mq-5mg.jpg",
    "follistatin":        f"{SB_DIR}/follistatin-1mg.jpg",
    "b12":                f"{SB_DIR}/b12-10mg.jpg",
    # Stacks
    "klow-stack":         f"{SB_DIR}/klow-stack-80mg.jpg",
    "weight-loss-stack":  f"{SB_DIR}/stack-weight-loss.jpg",
    "glow-stack":         f"{SB_DIR}/stack-glow-1vial.jpg",
    "glow-blend":         f"{SB_DIR}/stack-glow-1vial.jpg",
    "limitless-stack":    f"{SB_DIR}/stack-limitless.jpg",
    "gh-optimizer":       f"{SB_DIR}/stack-gh-optimizer.jpg",
    "gh-synergy":         f"{SB_DIR}/stack-gh-synergy-1vial.jpg",
    "fountain-of-youth":  f"{SB_DIR}/stack-fountain-of-youth.jpg",
    "appetite-crusher":   f"{SB_DIR}/stack-appetite-crusher-2vial.jpg",
    "immunity-stack":     f"{SB_DIR}/stack-immunity.jpg",
    "radiance-stack":     f"{SB_DIR}/stack-radiance.jpg",
    "ultimate-passion":   f"{SB_DIR}/stack-ultimate-passion.jpg",
    "ultimate-recovery":  f"{SB_DIR}/stack-ultimate-recovery.jpg",
    "furnace-stack":      f"{SB_DIR}/stack-furnace-1vial.jpg",
    "lipolysis-stack":    f"{SB_DIR}/lipolysis-stack-10ml.jpg",
    "skinny-shot":        f"{SB_DIR}/skinny-shot-10ml.jpg",
}

# ─────────────────────────────────────────────────────────────────────────────
# PEPNATION — slug → image file in public/images/products/
# ─────────────────────────────────────────────────────────────────────────────
PN_DIR = "public/images/products"
PEPNATION_MAP = {
    "tirzepatide":        f"{PN_DIR}/tirzepatide-tr10.png",
    "retatrutide":        f"{PN_DIR}/retatrutide-rt10.png",
    "semaglutide":        f"{PN_DIR}/semaglutide-sm10.png",
    "bpc-157":            f"{PN_DIR}/bpc-157-bc10.png",
    "tb-500":             f"{PN_DIR}/tb500-thymosin-b4-acetate-bt10.png",
    "cagrilintide":       f"{PN_DIR}/cagrilintide-cgl10.png",
    "ipamorelin":         f"{PN_DIR}/ipamorelin-ip10.png",
    "sermorelin":         f"{PN_DIR}/sermorelin-acetate-smo10.png",
    "ghrp-2":             f"{PN_DIR}/ghrp-2-acetate-g210.png",
    "ghrp-6":             f"{PN_DIR}/ghrp-6-acetate-g610.png",
    "cjc-1295-dac":       f"{PN_DIR}/cjc-1295-with-dac-cd5.png",
    "cjc-1295-no-dac":    f"{PN_DIR}/cjc-1295-without-dac-cnd10.png",
    "aod-9604":           f"{PN_DIR}/aod9604-10ad.png",
    "epithalon":          f"{PN_DIR}/epithalon-et10.png",
    "pt-141":             f"{PN_DIR}/pt-141-p41.png",
    "melanotan-ii":       f"{PN_DIR}/mt-2.png",
    "melanotan-1":        f"{PN_DIR}/mt-1-mt1.png",
    "oxytocin":           f"{PN_DIR}/oxytocin-acetate-ot10.png",
    "kisspeptin-10":      f"{PN_DIR}/kisspeptin-10-ks10.png",
    "hexarelin":          f"{PN_DIR}/hexarelin-acetate-hx5.png",
    "hgh-fragment":       f"{PN_DIR}/hgh-fragment-176-191-fr5.png",
    "igf-1-lr3":          f"{PN_DIR}/igf-1lr3-ig1.png",
    "mots-c":             f"{PN_DIR}/mots-c-ms10.png",
    "ss-31":              f"{PN_DIR}/ss-31-2s10.png",
    "nad-plus":           f"{PN_DIR}/nad-nj100.png",
    "glutathione":        f"{PN_DIR}/glutathione-gtt.png",
    "ghk-cu":             f"{PN_DIR}/ghk-cu-cu100.png",
    "ahk-cu":             f"{PN_DIR}/ahk-cu-au100.png",
    "kpv":                f"{PN_DIR}/kpv-kp10.png",
    "dsip":               f"{PN_DIR}/dsip-ds10.png",
    "selank":             f"{PN_DIR}/selank-sk10.png",
    "semax":              f"{PN_DIR}/semax-xa10.png",
    "dihexa":             f"{PN_DIR}/dihexa.png",
    "pinealon":           f"{PN_DIR}/pinealon-pn10.png",
    "vip":                f"{PN_DIR}/vip-vp10.png",
    "ll-37":              f"{PN_DIR}/ll37-375.png",
    "snap-8":             f"{PN_DIR}/snap-8-np810.png",
    "ara-290":            f"{PN_DIR}/ara290-cibinetide-ra10.png",
    "thymosin-alpha-1":   f"{PN_DIR}/thymosin-alpha-1-ta10.png",
    "thymalin":           f"{PN_DIR}/thymalin-ty10.png",
    "aicar":              f"{PN_DIR}/aicar-ar50.png",
    "foxo4-dri":          f"{PN_DIR}/foxo4-dri-f410.png",
    "tesamorelin":        f"{PN_DIR}/tesamorelin-tsm10.png",
    "survodutide":        f"{PN_DIR}/survodutide-sur10.png",
    "hcg":                f"{PN_DIR}/hcg-g5k.png",
    "hmg":                f"{PN_DIR}/hmg-g75.png",
    "melatonin":          f"{PN_DIR}/melatonin-mt10.png",
    "bac-water":          f"{PN_DIR}/bac-water-ba10.png",
    "cerebrolysin":       f"{PN_DIR}/cerebrolysin-cbl60.png",
    "5-amino-1mq":        f"{PN_DIR}/5-amino-1mq-5am.png",
    "follistatin":        f"{PN_DIR}/follistatin-fn1.png",
    "b12":                f"{PN_DIR}/b12-b12.png",
    # Stacks
    "klow-stack":         f"{PN_DIR}/klow-tb10-bpc10-ghk50-kpv10-k80.png",
    "glow-stack":         f"{PN_DIR}/glow-tb10-bpc10-ghk50-bbg70.png",
    "glow-blend":         f"{PN_DIR}/glow-blend.png",
    "limitless-stack":    f"{PN_DIR}/limitless-stack.png",
    "shred-stack":        f"{PN_DIR}/shred-stack.png",
    "wolverine-stack":    f"{PN_DIR}/wolverine-stack.png",
}

if __name__ == "__main__":
    print("\n═══ Savage Brands composites ════════════════════════════════")
    for slug, img_path in SAVAGE_MAP.items():
        out = f"public/images/storefront/savagebrands/{slug}-card.jpg"
        make_composite(img_path, out)

    print("\n═══ PepNation composites ════════════════════════════════════")
    for slug, img_path in PEPNATION_MAP.items():
        out = f"public/images/storefront/pepnation/{slug}-card.jpg"
        make_composite(img_path, out)

    print("\nAll done! ✨\n")
