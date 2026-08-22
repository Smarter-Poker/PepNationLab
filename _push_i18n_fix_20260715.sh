#!/bin/bash
# One-shot: publish the manufacturer i18n coverage fix (admin-approval status
# key + remaining login strings) and bring this checkout current with origin.
set -euo pipefail
export GIT_LITERAL_PATHSPECS=1

cd /Users/smarter.poker/Documents/pepnationlab

rm -f .git/index.lock

git config user.name "Smarter-Poker"
git config user.email "254329056+Smarter-Poker@users.noreply.github.com"

git add -- "lib/i18n/manufacturer-dict.ts" "app/login/page.tsx"

git commit -m "fix(manufacturer-i18n): full translation coverage - admin-approval status key + remaining login strings

Verification sweep findings: statusKey('admin_approval_pending') had no
dictionary entry (would render the raw key on the manufacturer Orders tab),
and the login page still had five hardcoded English sites (Google button,
Google redirect state, three Google-unavailable errors, generic catch).
All now resolve through the EN/zh-CN/zh-TW dictionary."

echo "=== rebase on latest origin/main ==="
git pull --rebase origin main

echo "=== pushing ==="
git push origin main

git log --oneline -3
echo "PUSH_COMPLETE"
