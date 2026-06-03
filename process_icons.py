import os
import glob
import subprocess

brain_dir = "/Users/smarter.poker/.gemini/antigravity/brain/6572f236-d119-4cf1-bf66-a49d69174aaa"
out_dir = "/Users/smarter.poker/Documents/pepnationlab/public/images/areas/icons"

prefixes = {
    "tissue_repair": "icon_tissue_",
    "healing": "icon_healing_",
    "metabolic": "icon_metabolic_",
    "weight_management": "icon_weight_management_",
    "longevity": "icon_longevity_",
    "cosmetic": "icon_cosmetic_",
    "cognitive": "icon_cognitive_",
    "immune": "icon_immune_",
    "gut_health": "icon_gut_health_",
    "pain_inflammation": "icon_pain_inflammation_",
    "bone_joint": "icon_bone_joint_",
    "sexual_health": "icon_sexual_health_",
    "performance": "icon_performance_",
    "sleep": "icon_sleep_",
    "mitochondrial": "icon_mitochondrial_"
}

for name, prefix in prefixes.items():
    files = glob.glob(f"{brain_dir}/{prefix}*.png")
    if not files:
        print(f"No file found for {name} ({prefix})")
        continue
    # get latest
    latest_file = max(files, key=os.path.getctime)
    
    out_file = f"{out_dir}/{name}.png"
    print(f"Processing {latest_file} -> {out_file}")
    
    cmd = [
        "magick", latest_file,
        "-fuzz", "25%",
        "-fill", "none",
        "-draw", "color 0,0 floodfill",
        "-draw", "color 0,1023 floodfill",
        "-draw", "color 1023,0 floodfill",
        "-draw", "color 1023,1023 floodfill",
        out_file
    ]
    subprocess.run(cmd, check=True)

print("Done processing icons.")
