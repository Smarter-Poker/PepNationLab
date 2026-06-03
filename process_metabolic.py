import subprocess

in_file = "/Users/smarter.poker/.gemini/antigravity/brain/6572f236-d119-4cf1-bf66-a49d69174aaa/metabolic_v2_1780503786393.png"
out_file = "/Users/smarter.poker/Documents/pepnationlab/public/images/areas/metabolic.png"

cmd = [
    "magick", in_file,
    "-fuzz", "10%",
    "-fill", "none",
    "-draw", "color 0,0 floodfill",
    "-draw", "color 0,1023 floodfill",
    "-draw", "color 1023,0 floodfill",
    "-draw", "color 1023,1023 floodfill",
    out_file
]
subprocess.run(cmd, check=True)
