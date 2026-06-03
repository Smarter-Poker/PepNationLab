import subprocess

in_file = "/Users/smarter.poker/.gemini/antigravity/brain/6572f236-d119-4cf1-bf66-a49d69174aaa/longevity_v2_1780504457885.png"
out_file = "/Users/smarter.poker/Documents/pepnationlab/public/images/areas/longevity.png"

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
