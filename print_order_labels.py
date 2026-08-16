import requests
import time
from io import BytesIO
from PIL import Image
from niimprint.printer import PrinterClient, BluetoothTransport

# The 5 labels for Cindy's order
files = [
    "retatrutide-rt10.png",
    "glow-tb10-bpc10-ghk50-bbg70.png",
    "nad-nj100.png",
    "mots-c-ms10.png",
    "bac-water-ba10.png"
]

base_url = "https://tmyyofivcbfncypsubkq.supabase.co/storage/v1/object/public/print-labels/"

print("Connecting to Niimbot...")
try:
    transport = BluetoothTransport("C9:26:11:06:00:47")
    printer = PrinterClient(transport)
    print("Connected successfully!")
except Exception as e:
    print(f"Failed to connect: {e}")
    exit(1)

for f in files:
    print(f"Downloading {f}...")
    url = base_url + f
    resp = requests.get(url)
    if resp.status_code != 200:
        print(f"Failed to download {url}")
        continue
    img = Image.open(BytesIO(resp.content))
    print(f"Printing {f} (size {img.size})...")
    # Rotate 90 degrees if necessary. Most Niimbot prints expect specific orientation.
    # We will just print the image as downloaded.
    printer.print_image(img, density=3)
    time.sleep(2) # Give printer some time between prints

print("Done printing all labels!")
