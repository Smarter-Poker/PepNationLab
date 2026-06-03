import os
import glob
import subprocess

brain_dir = "/Users/smarter.poker/.gemini/antigravity/brain/6572f236-d119-4cf1-bf66-a49d69174aaa"
out_dir = "/Users/smarter.poker/Documents/pepnationlab/public/images/areas"

prefixes = {
    "tissue_repair": "matte_tissue_repair_",
    "healing": "matte_healing_",
    "metabolic": "matte_metabolic_",
    "weight_management": "matte_weight_management_",
    "longevity": "matte_longevity_",
    "cosmetic": "matte_cosmetic_",
    "cognitive": "matte_cognitive_",
    "immune": "matte_immune_",
    "gut_health": "matte_gut_health_",
    "pain_inflammation": "matte_pain_inflammation_",
    "bone_joint": "matte_bone_joint_",
    "sexual_health": "matte_sexual_health_",
    "performance": "matte_performance_",
    "sleep": "matte_sleep_",
    "mitochondrial": "matte_mitochondrial_"
}

for name, prefix in prefixes.items():
    files = glob.glob(f"{brain_dir}/{prefix}*.png")
    if not files:
        print(f"No file found for {name} ({prefix})")
        continue
    latest_file = max(files, key=os.path.getctime)
    
    out_file = f"{out_dir}/{name}.png"
    print(f"Processing {latest_file} -> {out_file}")
    
    cmd = [
        "magick", latest_file,
        "-fuzz", "10%",
        "-fill", "none",
        "-draw", "color 0,0 floodfill",
        "-draw", "color 0,1023 floodfill",
        "-draw", "color 1023,0 floodfill",
        "-draw", "color 1023,1023 floodfill",
        out_file
    ]
    subprocess.run(cmd, check=True)

print("Done processing full matte cards.")
