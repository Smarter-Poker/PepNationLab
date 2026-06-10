import os
import glob
import subprocess
import shutil

brain_dir = "/Users/smarter.poker/.gemini/antigravity/brain/5412de48-315f-464a-bc62-bbbfee7dea0a"
out_dir = "public/images/research"

# prefixes for all images we need
prefixes = [
    "icon_weight_management", "icon_tissue_repair", "icon_healing", "icon_performance", "icon_cosmetic",
    "icon_cognitive", "icon_pain_inflammation", "icon_gut_health", "icon_sexual_health", "icon_sleep",
    "icon_longevity", "icon_bone_joint", "icon_immune", "icon_metabolic", "icon_mitochondrial",
    "btn_view_all_areas", "box_new_to_peptides"
]

for prefix in prefixes:
    files = glob.glob(f"{brain_dir}/{prefix}_*.png")
    if not files:
        print(f"No file found for {prefix}")
        continue
    # Sort to get the latest one
    files.sort()
    latest_file = files[-1]
    
    out_file = f"{out_dir}/{prefix}.png"
    print(f"Processing {latest_file} -> {out_file}")
    
    # Run rembg
    cmd = f"source .venv/bin/activate && rembg i '{latest_file}' '{out_file}'"
    subprocess.run(cmd, shell=True, executable='/bin/zsh')
print("Done processing images.")
