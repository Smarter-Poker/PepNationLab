from PIL import Image

base_img_path = "public/images/products/aod9604-10ad.png"
logo_path = "public/images/logo-savage.jpg"
output_path = "/tmp/test_logo_swap.jpg"

base = Image.open(base_img_path).convert("RGBA")
logo = Image.open(logo_path).convert("RGBA")

print(f"Base size: {base.size}")

logo_size = 180
logo = logo.resize((logo_size, logo_size))

x = base.width // 2 - logo_size // 2
y = int(base.height * 0.45) 

base.paste(logo, (x, y), logo)

bg = Image.new("RGB", base.size, (255, 255, 255))
bg.paste(base, mask=base.split()[3]) 
bg.save(output_path, quality=95)

print(f"Saved test to {output_path}")
