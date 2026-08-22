#!/bin/bash
# Deploy: Top 10 storefront card — remove Semaglutide + The Furnace Stack +
# The Lipolysis Stack; surface Tirzepatide + Retatrutide. Patches a FRESH
# origin/main worktree (assertion-guarded) and pushes. Safe to double-click;
# re-running after success is a no-op (patch self-skips if already applied).
set -uo pipefail
REPO="/Users/smarter.poker/Documents/pepnationlab"
DIR="$(cd "$(dirname "$0")" && pwd)"
LOG="$REPO/.claude_deploy_top10.log"
: > "$LOG"
log() { echo "$@" | tee -a "$LOG"; }

log "=== top10 deploy started $(date) ==="
cd "$REPO" || { log "FAIL: repo not found at $REPO"; exit 1; }

git fetch origin main 2>&1 | tee -a "$LOG" || { log "FAIL: git fetch"; exit 1; }

BASE="$(mktemp -d)"
WT="$BASE/pnl-top10"
git worktree add --detach "$WT" origin/main 2>&1 | tee -a "$LOG" || { log "FAIL: worktree add"; exit 1; }
cleanup() { cd "$REPO"; git worktree remove --force "$WT" >/dev/null 2>&1; rm -rf "$BASE" >/dev/null 2>&1; }
trap cleanup EXIT

python3 "$DIR/patch_top10_exclude.py" "$WT" 2>&1 | tee -a "$LOG"
if [ "${PIPESTATUS[0]}" -ne 0 ]; then log "FAIL: patch aborted (no push)"; exit 1; fi

cd "$WT" || { log "FAIL: cd worktree"; exit 1; }
git add "components/AgentStorefrontGrid.tsx" "lib/cities/top10-server.ts"
if git diff --cached --quiet; then log "NOTE: nothing staged (already on origin?) — no push"; log "DEPLOY_OK"; exit 0; fi

git -c user.name="Smarter-Poker" -c user.email="254329056+Smarter-Poker@users.noreply.github.com" \
  commit -m "Top 10 card: exclude Semaglutide + Furnace + Lipolysis stacks so Tirzepatide + Retatrutide surface

The storefront 'Top 10 Best Peptides' card (AgentStorefrontGrid, activeCardIndex
=== 1) and the city-page mirror (lib/cities/top10-server.ts) rank stacks with a
+20000 bonus, so simply dropping an item from POPULAR_ORDER cannot remove a
stack from the Top 10. Add a shared TOP10_EXCLUDE set filtered at the dedupe
step to drop Semaglutide, The Furnace Stack, and The Lipolysis Stack; this frees
three slots so Tirzepatide and Retatrutide (already ranked next) surface.

Co-Authored-By: Claude <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011W24tAhXB41us5NPaNpSBa" 2>&1 | tee -a "$LOG" || { log "FAIL: commit"; exit 1; }

NEWSHA="$(git rev-parse HEAD)"
git push origin "HEAD:main" 2>&1 | tee -a "$LOG" || { log "FAIL: push (check credentials/network)"; exit 1; }
log "PUSHED $NEWSHA"
log "DEPLOY_OK"
