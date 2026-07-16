#!/bin/bash
# One-shot: publish the Manufacturer Account feature (Betsy) to origin/main
# as Smarter-Poker. Run on Dan's Mac (real network + git creds).
set -euo pipefail
export GIT_LITERAL_PATHSPECS=1

cd /Users/smarter.poker/Documents/pepnationlab

# Clear any stale lock left by read-only tooling
rm -f .git/index.lock

git config user.name "Smarter-Poker"
git config user.email "254329056+Smarter-Poker@users.noreply.github.com"

FILES=(
  "supabase/migrations/20260715090000_manufacturer_accounts.sql"
  "app/api/orders/route.ts"
  "app/api/agent/products/route.ts"
  "lib/schemas/product.ts"
  "lib/statements.ts"
  "lib/bundles.ts"
  "lib/admin-auth.ts"
  "app/dashboard/page.tsx"
  "app/dashboard/agent/page.tsx"
  "app/[agentSlug]/page.tsx"
  "app/checkout/page.tsx"
  "app/checkout/CheckoutForm.tsx"
  "components/AgentStorefrontGrid.tsx"
  "app/login/page.tsx"
  "lib/i18n/manufacturer-dict.ts"
  "lib/i18n/index.tsx"
  "app/api/manufacturer/overview/route.ts"
  "app/api/manufacturer/locale/route.ts"
  "app/dashboard/manufacturer/page.tsx"
  "app/dashboard/manufacturer/ManufacturerDashboardClient.tsx"
)

echo "=== staging ${#FILES[@]} files ==="
for f in "${FILES[@]}"; do
  git add -- "$f"
done

git commit -m "feat(manufacturer): Betsy manufacturer account - unrestricted pricing, 10-vial multiples, 90/10 commission ledger, trilingual EN/zh-CN/zh-TW dashboard"

echo "=== rebase on latest origin/main ==="
git pull --rebase origin main

echo "=== pushing ==="
git push origin main

git log --oneline -2
echo "PUSH_COMPLETE"
