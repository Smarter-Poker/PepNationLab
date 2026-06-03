import subprocess

healing_file = "/Users/smarter.poker/Documents/pepnationlab/public/images/areas/healing.png"
out_file = "/Users/smarter.poker/Documents/pepnationlab/public/images/areas/perfect_template.png"

# We will paint a rectangle over the center area (icon and text) with the dark matte color
# from the healing image. The dark matte color is around #191B1F or so.
# Let's pick a coordinate from the top-left inside the frame, e.g., (200, 200).
cmd = [
    "magick", healing_file,
    "-fill", "#1c1c1f",  # Approximating the dark matte interior
    "-draw", "rectangle 120,120 904,904",
    out_file
]
subprocess.run(cmd, check=True)
