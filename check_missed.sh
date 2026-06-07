#!/bin/bash
MISSED_DIRS="app/[agentSlug] app/about app/checkout app/compliance app/disclaimer app/find-a-peptide app/forgot-password app/lab-tools app/orders app/privacy app/products app/register app/status app/terms app/wallet app/(storefront)"

for dir in $MISSED_DIRS; do
  if [ -d "$dir" ]; then
    FILES=$(find "$dir" -name "page.tsx" -o -name "layout.tsx")
    for f in $FILES; do
      if grep -inE "(100vh|overflow|zIndex|autoFocus|<input|<textarea|safe-area)" "$f" > /dev/null; then
        echo "--- Checking $f ---"
        grep -inE "(100vh|overflow|zIndex|autoFocus|<input|<textarea|safe-area)" "$f"
      fi
    done
  fi
done
