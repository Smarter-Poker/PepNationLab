#!/bin/bash
set -e
DEST="/Users/smarter.poker/Documents/pepnationlab/public/images/ui/pills"
mkdir -p "$DEST"

SRC="/Users/smarter.poker/.gemini/antigravity/brain/84be3457-9b05-49a6-b603-a22013a21b84"
PARENT_SRC="/Users/smarter.poker/.gemini/antigravity/brain/f43c3319-e873-4aca-a857-f729f4c03c92"

cp $SRC/sample_1mg_vials*.jpg "$DEST/1mg.png"
cp $SRC/sample_10mg_vials*.jpg "$DEST/10mg.png"
cp $SRC/sample_20mg_vials*.jpg "$DEST/20mg.png"
cp $SRC/sample_50mg_vials*.jpg "$DEST/50mg.png"
cp $SRC/sample_70mg_vials*.jpg "$DEST/70mg.png"
cp $SRC/sample_80mg_vials*.jpg "$DEST/80mg.png"
cp $SRC/sample_600mg_vials*.jpg "$DEST/600mg.png"
cp $SRC/sample_1000mg_vials*.jpg "$DEST/1000mg.png"
cp $SRC/sample_1500mg_vials*.jpg "$DEST/1500mg.png"
cp $SRC/sample_3ml_vials*.jpg "$DEST/3ml.png"
cp $SRC/sample_10ml_vials*.jpg "$DEST/10ml.png"
cp $SRC/sample_75iu_vials*.jpg "$DEST/75iu.png"

cp "$PARENT_SRC/sample_5mg_vials_1785412367125.jpg" "$DEST/5mg.png"
cp "$PARENT_SRC/sample_100mg_vials_1785412379015.jpg" "$DEST/100mg.png"

source venv_rembg/bin/activate

for size in 1mg 5mg 10mg 20mg 50mg 70mg 80mg 100mg 600mg 1000mg 1500mg 3ml 10ml 75iu; do
  echo "Processing $size..."
  rembg i "$DEST/${size}.png" "$DEST/${size}_nobg.png"
  mv "$DEST/${size}_nobg.png" "$DEST/${size}.png"
done

echo "Done!"
