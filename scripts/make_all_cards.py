"""
Batch-generates all PremiumPeptideCard composites using the EXACT compound_slug
values from the database (verified via supabase migration backfill scripts).

Outputs brand-separated:
  public/images/storefront/savagebrands/<slug>-card.jpg
  public/images/storefront/pepnation/<slug>-card.jpg

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
        print(f"  ⚠️  SKIP (not found): {vial_path}")
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

    # Restore V-chrome via lighten blend
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
    print(f"  ✅  {os.path.basename(out_path)}")


# ─────────────────────────────────────────────────────────────────────────────
# SAVAGE BRANDS
# Keys are the EXACT compound_slug values from products table (DB migrations)
# ─────────────────────────────────────────────────────────────────────────────
SB = "public/images/savage-brands"
SAVAGE_MAP = {
    # ── GLP-1 / weight loss ──────────────────────────────────────────────────
    "tirzepatide":           f"{SB}/tirzepatide-10mg.jpg",
    "retatrutide":           f"{SB}/retatrutide-10mg.jpg",
    "semaglutide":           f"{SB}/semaglutide-10mg.jpg",
    "cagrilintide":          f"{SB}/cagrilintide-10mg.jpg",
    "survodutide":           f"{SB}/survodutide-10mg.jpg",
    # ── Peptides ─────────────────────────────────────────────────────────────
    "bpc-157":               f"{SB}/bpc-157-10mg.jpg",
    "tb-500":                f"{SB}/tb-500-10mg.jpg",
    "ipamorelin":            f"{SB}/ipamorelin-10mg.jpg",
    "sermorelin":            f"{SB}/sermorelin-10mg.jpg",
    "ghrp-2":                f"{SB}/ghrp2-10mg.jpg",
    "ghrp-6":                f"{SB}/ghrp6-10mg.jpg",
    "cjc-1295-dac":          f"{SB}/cjc1295-with-dac-5mg.jpg",
    "cjc-1295-no-dac":       f"{SB}/cjc1295-without-dac-10mg.jpg",
    "cjc-ipamorelin":        f"{SB}/cjc1295-without-dac-10mg.jpg",
    "aod9604":               f"{SB}/aod9604-10mg.jpg",
    "epithalon":             f"{SB}/epithalon-10mg.jpg",
    "pt-141":                f"{SB}/pt141-10mg.jpg",
    "mt-2":                  f"{SB}/mt2-10mg.jpg",
    "mt-1":                  f"{SB}/mt-1-10mg.jpg",
    "oxytocin":              f"{SB}/oxytocin-10mg.jpg",
    "kisspeptin-10":         f"{SB}/kisspeptin10-10mg.jpg",
    "hexarelin":             f"{SB}/hexarelin-5mg.jpg",
    "hgh-fragment-176-191":  f"{SB}/hgh-fragment-5mg.jpg",
    "hgh-191aa":             f"{SB}/hgh-fragment-5mg.jpg",
    "igf-1-lr3":             f"{SB}/igf1-lr3-1mg.jpg",
    "mots-c":                f"{SB}/motsc-10mg.jpg",
    "ss-31":                 f"{SB}/ss-31-10mg.jpg",
    "nad-plus":              f"{SB}/nad-100mg.jpg",
    "glutathione":           f"{SB}/glutathione-1500mg.jpg",
    "ghk-cu":                f"{SB}/ghkcu-100mg.jpg",
    "ahk-cu":                f"{SB}/ahkcu-100mg.jpg",
    "kpv":                   f"{SB}/kpv-10mg.jpg",
    "dsip":                  f"{SB}/dsip-10mg.jpg",
    "selank":                f"{SB}/selank-5mg.jpg",
    "semax":                 f"{SB}/semax-10mg.jpg",
    "dihexa":                f"{SB}/dihexa-30mg.jpg",
    "pinealon":              f"{SB}/pinealon-10mg.jpg",
    "vip":                   f"{SB}/vip-10mg.jpg",
    "ll-37":                 f"{SB}/ll-37-5mg.jpg",
    "snap-8":                f"{SB}/snap-8-10mg.jpg",
    "ara-290":               f"{SB}/ara290-10mg.jpg",
    "thymosin-alpha-1":      f"{SB}/thymosin-alpha-1-10mg.jpg",
    "thymalin":              f"{SB}/thymalin-10mg.jpg",
    "aicar":                 f"{SB}/aicar-50mg.jpg",
    "foxo4-dri":             f"{SB}/foxo4dri-10mg.jpg",
    "tesamorelin":           f"{SB}/tesamorelin-10mg.jpg",
    "hcg":                   f"{SB}/hcg-5000iu.jpg",
    "hmg":                   f"{SB}/hmg-75iu.jpg",
    "melatonin":             f"{SB}/melatonin-10mg.jpg",
    "bac-water":             f"{SB}/bac-water.jpg",
    "acetic-acid":           f"{SB}/acetic-acid.jpg",
    "cerebrolysin":          f"{SB}/cerebrolysin-60mg.jpg",
    "5-amino-1mq":           f"{SB}/5-amino-1mq-5mg.jpg",
    "follistatin":           f"{SB}/follistatin-1mg.jpg",
    "b12":                   f"{SB}/b12-10mg.jpg",
    "l-carnitine":           f"{SB}/lipolysis-stack-10ml.jpg",
    # ── Stacks (exact DB slugs) ───────────────────────────────────────────────
    "klow":                  f"{SB}/klow-stack-80mg.jpg",
    "glow":                  f"{SB}/stack-glow-1vial.jpg",
    "limitless-stack":       f"{SB}/stack-limitless.jpg",
    "shred-stack":           f"{SB}/stack-weight-loss.jpg",
    "bpc-tb":                f"{SB}/bpc-157-10mg.jpg",
    "cagrisema":             f"{SB}/cagrilintide-10mg.jpg",
}

# ─────────────────────────────────────────────────────────────────────────────
# PEPNATION — same exact DB slugs, different images
# ─────────────────────────────────────────────────────────────────────────────
PN = "public/images/products"
PEPNATION_MAP = {
    "tirzepatide":           f"{PN}/tirzepatide-tr10.png",
    "retatrutide":           f"{PN}/retatrutide-rt10.png",
    "semaglutide":           f"{PN}/semaglutide-sm10.png",
    "cagrilintide":          f"{PN}/cagrilintide-cgl10.png",
    "survodutide":           f"{PN}/survodutide-sur10.png",
    "bpc-157":               f"{PN}/bpc-157-bc10.png",
    "tb-500":                f"{PN}/tb500-thymosin-b4-acetate-bt10.png",
    "ipamorelin":            f"{PN}/ipamorelin-ip10.png",
    "sermorelin":            f"{PN}/sermorelin-acetate-smo10.png",
    "ghrp-2":                f"{PN}/ghrp-2-acetate-g210.png",
    "ghrp-6":                f"{PN}/ghrp-6-acetate-g610.png",
    "cjc-1295-dac":          f"{PN}/cjc-1295-with-dac-cd5.png",
    "cjc-1295-no-dac":       f"{PN}/cjc-1295-without-dac-cnd10.png",
    "cjc-ipamorelin":        f"{PN}/cjc-1295-without-dac-5mg-ipa-5mg-cp10.png",
    "aod9604":               f"{PN}/aod9604-10ad.png",
    "epithalon":             f"{PN}/epithalon-et10.png",
    "pt-141":                f"{PN}/pt-141-p41.png",
    "mt-2":                  f"{PN}/mt-2.png",
    "mt-1":                  f"{PN}/mt-1-mt1.png",
    "oxytocin":              f"{PN}/oxytocin-acetate-ot10.png",
    "kisspeptin-10":         f"{PN}/kisspeptin-10-ks10.png",
    "hexarelin":             f"{PN}/hexarelin-acetate-hx5.png",
    "hgh-fragment-176-191":  f"{PN}/hgh-fragment-176-191-fr5.png",
    "igf-1-lr3":             f"{PN}/igf-1lr3-ig1.png",
    "mots-c":                f"{PN}/mots-c-ms10.png",
    "ss-31":                 f"{PN}/ss-31-2s10.png",
    "nad-plus":              f"{PN}/nad-nj100.png",
    "glutathione":           f"{PN}/glutathione-gtt.png",
    "ghk-cu":                f"{PN}/ghk-cu-cu100.png",
    "ahk-cu":                f"{PN}/ahk-cu-au100.png",
    "kpv":                   f"{PN}/kpv-kp10.png",
    "dsip":                  f"{PN}/dsip-ds10.png",
    "selank":                f"{PN}/selank-sk10.png",
    "semax":                 f"{PN}/semax-xa10.png",
    "dihexa":                f"{PN}/dihexa.png",
    "pinealon":              f"{PN}/pinealon-pn10.png",
    "vip":                   f"{PN}/vip-vp10.png",
    "ll-37":                 f"{PN}/ll37-375.png",
    "snap-8":                f"{PN}/snap-8-np810.png",
    "ara-290":               f"{PN}/ara290-cibinetide-ra10.png",
    "thymosin-alpha-1":      f"{PN}/thymosin-alpha-1-ta10.png",
    "thymalin":              f"{PN}/thymalin-ty10.png",
    "aicar":                 f"{PN}/aicar-ar50.png",
    "foxo4-dri":             f"{PN}/foxo4-dri-f410.png",
    "tesamorelin":           f"{PN}/tesamorelin-tsm10.png",
    "hcg":                   f"{PN}/hcg-g5k.png",
    "hmg":                   f"{PN}/hmg-g75.png",
    "melatonin":             f"{PN}/melatonin-mt10.png",
    "bac-water":             f"{PN}/bac-water-ba10.png",
    "acetic-acid":           f"{PN}/acetic-acid-0-6-aa10.png",
    "cerebrolysin":          f"{PN}/cerebrolysin-cbl60.png",
    "5-amino-1mq":           f"{PN}/5-amino-1mq-5am.png",
    "follistatin":           f"{PN}/follistatin-fn1.png",
    "b12":                   f"{PN}/b12-b12.png",
    "l-carnitine":           f"{PN}/l-carnitine-lc600.png",
    # Stacks (exact DB slugs)
    "klow":                  f"{PN}/klow-tb10-bpc10-ghk50-kpv10-k80.png",
    "glow":                  f"{PN}/glow-tb10-bpc10-ghk50-bbg70.png",
    "limitless-stack":       f"{PN}/limitless-stack.png",
    "shred-stack":           f"{PN}/shred-stack.png",
    "bpc-tb":                f"{PN}/bpc-10mg-tb-10mg-bb20.png",
    "cagrisema":             f"{PN}/cagrilintide-5mg-semaglutide-5mg-cs10.png",
}

if __name__ == "__main__":
    print("\n═══ Savage Brands composites ════════════════════════════════")
    for slug, img_path in SAVAGE_MAP.items():
        make_composite(img_path, f"public/images/storefront/savagebrands/{slug}-card.jpg")

    print("\n═══ PepNation composites ════════════════════════════════════")
    for slug, img_path in PEPNATION_MAP.items():
        make_composite(img_path, f"public/images/storefront/pepnation/{slug}-card.jpg")

    print("\nAll done! ✨\n")
