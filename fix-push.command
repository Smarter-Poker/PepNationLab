#!/bin/bash
set -e
cd /Users/smarter.poker/Documents/pepnationlab

echo "=== Backing up files to push ==="
cp components/AgentStorefrontGrid.tsx /tmp/AgentStorefrontGrid_full.tsx
cp public/images/products/cagrilintide-sema.png /tmp/cagrilintide-sema.png
cp public/images/products/klow-blend.png /tmp/klow-blend.png
cp public/images/products/wolverine-stack.png /tmp/wolverine-stack.png
echo "Backup complete."

echo ""
echo "=== Fetching origin ==="
git fetch origin

echo ""
echo "=== Resetting to origin/main (incorporates v5-v10 peptide work, fixes auth hole) ==="
git reset --hard origin/main

echo ""
echo "=== Restoring full AgentStorefrontGrid and updated images ==="
cp /tmp/AgentStorefrontGrid_full.tsx components/AgentStorefrontGrid.tsx
cp /tmp/cagrilintide-sema.png public/images/products/cagrilintide-sema.png
cp /tmp/klow-blend.png public/images/products/klow-blend.png
cp /tmp/wolverine-stack.png public/images/products/wolverine-stack.png

echo ""
echo "=== Staging and committing ==="
git add components/AgentStorefrontGrid.tsx
git add public/images/products/cagrilintide-sema.png public/images/products/klow-blend.png public/images/products/wolverine-stack.png
git commit -m "Fix: restore full AgentStorefrontGrid component (4115 lines) and update product images"

echo ""
echo "=== Pushing to origin/main ==="
git push origin main

echo ""
echo "=== Done! Remote state ==="
git log --oneline -5

echo ""
echo "DONE. Press Enter to close."
read
