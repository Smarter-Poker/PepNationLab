#!/bin/bash
FILES=$(find app/research -name "page.tsx")

for f in $FILES; do
  if grep -inE "<input|<textarea" "$f" > /dev/null; then
    echo "--- $f has inputs ---"
    grep -inE "<input|<textarea|className=.*form-input" "$f"
  fi
done
