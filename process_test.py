import subprocess

latest_file = "/Users/smarter.poker/.gemini/antigravity/brain/6572f236-d119-4cf1-bf66-a49d69174aaa/matte_healing_1780502746367.png"
out_file = "/Users/smarter.poker/Documents/pepnationlab/public/images/areas/test_healing.png"

cmd = [
    "magick", latest_file,
    "-fuzz", "5%",
    "-fill", "none",
    "-draw", "color 0,0 floodfill",
    "-draw", "color 0,1023 floodfill",
    "-draw", "color 1023,0 floodfill",
    "-draw", "color 1023,1023 floodfill",
    out_file
]
subprocess.run(cmd, check=True)
