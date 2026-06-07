#!/bin/bash
FILES=$(find app/dashboard app/account -name "page.tsx")

for f in $FILES; do
  if grep -inE "(100vh|overflow.*hidden|zIndex|autoFocus|safe-area)" "$f" > /dev/null; then
    echo "--- Checking $f ---"
    grep -inE "(100vh|overflow.*hidden|zIndex|autoFocus|safe-area)" "$f"
  fi
done
