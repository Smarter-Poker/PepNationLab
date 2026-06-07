#!/bin/bash
FILES=(
  "app/page.tsx"
  "app/login/page.tsx"
  "app/register/page.tsx"
  "app/forgot-password/page.tsx"
  "app/products/page.tsx"
  "app/checkout/page.tsx"
  "app/orders/page.tsx"
  "app/orders/[id]/page.tsx"
  "app/find-a-peptide/page.tsx"
  "app/lab-tools/page.tsx"
  "app/compliance/page.tsx"
  "app/disclaimer/page.tsx"
  "app/privacy/page.tsx"
  "app/terms/page.tsx"
  "app/status/page.tsx"
  "app/wallet/page.tsx"
  "app/wallet/print/page.tsx"
  "app/shipping/page.tsx"
)

for f in "${FILES[@]}"; do
  if grep -inE "<input|<textarea" "$f" > /dev/null; then
    echo "--- $f has inputs ---"
    grep -inE "<input|<textarea|className=.*form-input" "$f"
  fi
done
