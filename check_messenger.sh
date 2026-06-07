#!/bin/bash
FILES=$(find app/messenger -name "page.tsx")

for f in $FILES; do
  if grep -inE "<input|<textarea|100vh|overflow|zIndex" "$f" > /dev/null; then
    echo "--- $f has matches ---"
    grep -inE "<input|<textarea|100vh|overflow|zIndex" "$f"
  fi
done
