#!/bin/bash
# One-shot: publish the Store Bundles feature to origin/main as Smarter-Poker.
# Runs on Dan's Mac (real network + keychain git creds). Uses a FRESH clone in
# /tmp so it never touches the working tree or any other agent's in-flight work.
set -uo pipefail
export GIT_LITERAL_PATHSPECS=1   # so app/[agentSlug]/page.tsx is treated literally

REPO="https://github.com/Smarter-Poker/PepNationLab.git"
SRC="/Users/smarter.poker/Documents/pepnationlab"
WORK="/tmp/pnl_bundles_push"

echo "=== fresh clone ==="
rm -rf "$WORK"
git clone --filter=blob:none "$REPO" "$WORK" || { echo "CLONE_FAILED"; exit 1; }
cd "$WORK" || exit 1

git config user.name "Smarter-Poker"
git config user.email "254329056+Smarter-Poker@users.noreply.github.com"

FILES=(
  "lib/bundles.ts"
  "components/BundleManager.tsx"
  "components/AgentStorefrontConfig.tsx"
  "components/AgentStorefrontGrid.tsx"
  "app/api/agent/bundles/route.ts"
  "app/checkout/CheckoutForm.tsx"
  "app/[agentSlug]/page.tsx"
  "app/api/orders/route.ts"
)

echo "=== copy 8 feature files from working tree ==="
for f in "${FILES[@]}"; do
  mkdir -p "$(dirname "$WORK/$f")"
  cp "$SRC/$f" "$WORK/$f" || { echo "MISSING_SRC: $f"; exit 1; }
  git add -- "$f"
done

echo "=== changed files staged ==="
git status --porcelain

git commit -q -m "feat(storefront): Store Bundles — customizable bundle builder + storefront + checkout

Agents, super agents, and admin build a bundle of 2-5 catalog products with a
custom name, description, uploaded image, and optional discount %. Bundles render
as their own section directly below the Top 10 on the storefront with an
Add-Bundle-To-Cart action, and the per-bundle discount is applied authoritatively
at checkout (replacing the old flat 10%).

- BundleManager UI replaces the Featured Products picker in Storefront Config
  (create / edit / toggle / delete; image upload to public-assets)
- lib/bundles.ts: shared cascade resolver — scope self / downline (super agent ->
  sub-agents) / global (admin -> every store)
- /api/agent/bundles: image_url + scope + role-gated permissions + 2-5 cap + edit
- AgentStorefrontGrid: renders Research Bundles below Top 10; price = summed member
  vials minus discount; bundle cart lines carry bundleName + discount to checkout
- /api/orders + CheckoutForm: per-bundle discount_percent (was hardcoded 10%),
  honors cascaded/global bundles
- bundles_config stays JSONB (no migration)

Rebased onto current origin so the H9 chain-credit and guest-redirect work is
preserved. tsc clean.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>" || { echo "COMMIT_FAILED (nothing to commit?)"; exit 1; }

echo "=== push (with one rebase retry if origin moved) ==="
if git push origin HEAD:main; then
  echo "PUSH_OK"
else
  echo "push rejected — rebasing onto latest origin/main and retrying"
  git fetch origin main || { echo "FETCH_FAILED"; exit 1; }
  if git rebase origin/main; then
    git push origin HEAD:main && echo "PUSH_OK_AFTER_REBASE" || { echo "PUSH_FAILED_AFTER_REBASE"; exit 1; }
  else
    echo "REBASE_CONFLICT — aborting, needs manual resolution"; git rebase --abort; exit 1
  fi
fi

echo "=== result ==="
git log --oneline -3
echo "DONE_STORE_BUNDLES_PUSH"
