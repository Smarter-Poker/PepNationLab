#!/bin/bash
# PepNationLab — ship EXTRACTED_L (account-experience zh-CN/zh-TW dictionary).
# Adds lib/i18n/ui-extracted-l.ts and wires it into ui-dict.ts, on a FRESH
# origin/main worktree. Never touches the dev's working tree.
set -uo pipefail
REPO="/Users/smarter.poker/Documents/pepnationlab"
LOG="$REPO/_i18n_L.log"
exec > "$LOG" 2>&1
echo "=== i18n L run: $(date) ==="
EXPECT_L="f11f785b15b7f8c090a242aaff9f92b4bbe75ad0"
STAGE="$REPO/_ui_l_stage.ts"
cd "$REPO" || { echo "FATAL cd"; exit 1; }
[ -f "$STAGE" ] || { echo "FATAL: staged dict $STAGE missing"; exit 1; }
PY=$(mktemp /tmp/apply_dict.XXXXXX)
base64 -d > "$PY" <<'B64EOF'
IyEvdXNyL2Jpbi9lbnYgcHl0aG9uMwoiIiJXaXJlIEVYVFJBQ1RFRF9MIGludG8gbGliL2kxOG4vdWktZGljdC50cyAoaW1wb3J0ICsgbWVyZ2UgYXJyYXkpLgpBc3NlcnRpb24tZ3VhcmRlZDogZWFjaCBhbmNob3IgbXVzdCBvY2N1ciBleGFjdGx5IG9uY2UsIGVsc2UgYWJvcnQuIiIiCmltcG9ydCBzeXMKCkVESVRTID0gWwogICAgKAogICAgICAgICJpbXBvcnQgeyBFWFRSQUNURURfSyB9IGZyb20gJ0AvbGliL2kxOG4vdWktZXh0cmFjdGVkLWsnOyIsCiAgICAgICAgImltcG9ydCB7IEVYVFJBQ1RFRF9LIH0gZnJvbSAnQC9saWIvaTE4bi91aS1leHRyYWN0ZWQtayc7XG5pbXBvcnQgeyBFWFRSQUNURURfTCB9IGZyb20gJ0AvbGliL2kxOG4vdWktZXh0cmFjdGVkLWwnOyIsCiAgICApLAogICAgKAogICAgICAgICJmb3IgKGNvbnN0IHBhcnQgb2YgW0VYVFJBQ1RFRF9BLCBFWFRSQUNURURfQiwgRVhUUkFDVEVEX0MsIEVYVFJBQ1RFRF9ELCBFWFRSQUNURURfRSwgRVhUUkFDVEVEX0YsIEVYVFJBQ1RFRF9HLCBFWFRSQUNURURfSCwgRVhUUkFDVEVEX0ksIEVYVFJBQ1RFRF9KLCBFWFRSQUNURURfS10pIHsiLAogICAgICAgICJmb3IgKGNvbnN0IHBhcnQgb2YgW0VYVFJBQ1RFRF9BLCBFWFRSQUNURURfQiwgRVhUUkFDVEVEX0MsIEVYVFJBQ1RFRF9ELCBFWFRSQUNURURfRSwgRVhUUkFDVEVEX0YsIEVYVFJBQ1RFRF9HLCBFWFRSQUNURURfSCwgRVhUUkFDVEVEX0ksIEVYVFJBQ1RFRF9KLCBFWFRSQUNURURfSywgRVhUUkFDVEVEX0xdKSB7IiwKICAgICksCl0KCgpkZWYgbWFpbigpOgogICAgcGF0aCA9IHN5cy5hcmd2WzFdCiAgICBzID0gb3BlbihwYXRoLCBlbmNvZGluZz0idXRmLTgiKS5yZWFkKCkKICAgIGZvciBpLCAob2xkLCBuZXcpIGluIGVudW1lcmF0ZShFRElUUywgMSk6CiAgICAgICAgbiA9IHMuY291bnQob2xkKQogICAgICAgIGlmIG4gIT0gMToKICAgICAgICAgICAgcHJpbnQoZiJBQk9SVDogdWktZGljdC50cyBlZGl0ICN7aX06IGFuY2hvciBmb3VuZCB7bn0gdGltZXMgKGV4cGVjdGVkIDEpIikKICAgICAgICAgICAgc3lzLmV4aXQoMikKICAgICAgICBpZiBuZXcgaW4gcyBhbmQgb2xkIG5vdCBpbiBzLnJlcGxhY2UobmV3LCAiIik6CiAgICAgICAgICAgIHByaW50KGYiU0tJUDogdWktZGljdC50cyBlZGl0ICN7aX06IGFscmVhZHkgYXBwbGllZCIpCiAgICAgICAgICAgIGNvbnRpbnVlCiAgICAgICAgcyA9IHMucmVwbGFjZShvbGQsIG5ldywgMSkKICAgICAgICBwcmludChmIk9LOiB1aS1kaWN0LnRzIGVkaXQgI3tpfSBhcHBsaWVkIikKICAgIG9wZW4ocGF0aCwgInciLCBlbmNvZGluZz0idXRmLTgiKS53cml0ZShzKQogICAgcHJpbnQoIkRPTkUiKQoKCmlmIF9fbmFtZV9fID09ICJfX21haW5fXyI6CiAgICBtYWluKCkK
B64EOF
git worktree prune 2>/dev/null
git fetch origin main || { echo "FATAL fetch"; exit 1; }
TMP=$(mktemp -d /tmp/pnlL.XXXXXX)
git worktree add --detach "$TMP" origin/main || { echo "FATAL worktree"; exit 1; }
echo "worktree $TMP @ $(git -C "$TMP" rev-parse HEAD)"
cleanup(){ git worktree remove --force "$TMP" 2>/dev/null; rm -f "$PY"; }
cp "$STAGE" "$TMP/lib/i18n/ui-extracted-l.ts" || { echo "FATAL cp"; cleanup; exit 1; }
GOT_L=$(git -C "$TMP" hash-object lib/i18n/ui-extracted-l.ts)
echo "ui-extracted-l sha: $GOT_L (want $EXPECT_L)"
[ "$GOT_L" = "$EXPECT_L" ] || { echo "FATAL: dict sha mismatch"; cleanup; exit 1; }
python3 "$PY" "$TMP/lib/i18n/ui-dict.ts"; RC=$?
[ "$RC" = "0" ] || { echo "FATAL editor rc=$RC"; cleanup; exit 1; }
ESB="$REPO/node_modules/.bin/esbuild"
if [ -x "$ESB" ]; then
  "$ESB" "$TMP/lib/i18n/ui-extracted-l.ts" --bundle=false --outfile=/dev/null && echo "esbuild L OK" || { echo "FATAL esbuild L"; cleanup; exit 1; }
  "$ESB" "$TMP/lib/i18n/ui-dict.ts" --bundle=false --outfile=/dev/null && echo "esbuild dict OK" || { echo "FATAL esbuild dict"; cleanup; exit 1; }
else echo "note: esbuild absent — validated in prep"; fi
git -C "$TMP" add -A
git -C "$TMP" -c user.name='Smarter-Poker' -c user.email='254329056+Smarter-Poker@users.noreply.github.com' commit -m 'i18n(account): translate the account-experience surfaces to zh-CN/zh-TW

Adds lib/i18n/ui-extracted-l.ts (584 strings) and merges it in ui-dict.ts. Closes
the coverage gap on account creation, onboarding, agent/super/sub dashboards,
account/wallet/settings, checkout, and storefront chrome, so Chinese-locale
accounts no longer see a half-English UI. Keys are the decoded runtime strings;
UiTranslator swaps them at render. Admin and public marketing pages intentionally
out of scope.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>' || { echo "FATAL commit"; cleanup; exit 1; }
if ! git -C "$TMP" push origin HEAD:main; then
  echo "push rejected — rebase retry"
  git -C "$TMP" fetch origin main && git -C "$TMP" rebase origin/main || { echo "FATAL rebase"; git -C "$TMP" rebase --abort 2>/dev/null; cleanup; exit 1; }
  git -C "$TMP" push origin HEAD:main || { echo "FATAL push2"; cleanup; exit 1; }
fi
echo "PUSHED OK — $(git -C "$TMP" rev-parse HEAD)"
cleanup
rm -f "$STAGE"
echo "=== done: $(date) ==="
