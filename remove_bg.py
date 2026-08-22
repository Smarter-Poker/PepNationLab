from PIL import Image
import PIL.ImageChops as chops

def main():
    path = '/Users/smarter.poker/Documents/pepnationlab/public/images/coa-button.png'
    img = Image.open(path).convert("RGBA")
    
    newData = []
    corners = [img.getpixel((0,0)), img.getpixel((img.width-1, 0)), img.getpixel((0, img.height-1))]
    bg_color = corners[0] 
    
    if bg_color[3] == 0:
        print("Image is already transparent.")
        return
        
    width, height = img.size
    for y in range(height):
        for x in range(width):
            item = img.getpixel((x,y))
            if abs(item[0] - bg_color[0]) < 20 and abs(item[1] - bg_color[1]) < 20 and abs(item[2] - bg_color[2]) < 20:
                newData.append((255, 255, 255, 0))
            else:
                newData.append(item)
                
    img.putdata(newData)
    
    bg = Image.new(img.mode, img.size, img.getpixel((0,0)))
    diff = chops.difference(img, bg)
    diff = chops.add(diff, diff, 2.0, -100)
    bbox = diff.getbbox()
    if bbox:
        img = img.crop(bbox)
        
    img.save(path)
    print(f"Saved transparent cropped image to {path}, size: {img.size}")

if __name__ == '__main__':
    main()
