#!/bin/bash
# Deploy: Network Map cards open the agent detail drawer + show downline counts,
# and "% Rate" is relabelled "% Markup". Patches a FRESH origin/main worktree
# (assertion-guarded) and pushes. Safe to double-click; re-run is a no-op.
set -uo pipefail
REPO="/Users/smarter.poker/Documents/pepnationlab"
DIR="$(cd "$(dirname "$0")" && pwd)"
LOG="$REPO/.claude_deploy_networkmap.log"
: > "$LOG"
log() { echo "$@" | tee -a "$LOG"; }

log "=== network-map deploy started ==="
cd "$REPO" || { log "FAIL: repo not found at $REPO"; exit 1; }

git fetch origin main 2>&1 | tee -a "$LOG" || { log "FAIL: git fetch"; exit 1; }

BASE="$(mktemp -d)"
WT="$BASE/pnl-networkmap"
git worktree add --detach "$WT" origin/main 2>&1 | tee -a "$LOG" || { log "FAIL: worktree add"; exit 1; }
cleanup() { cd "$REPO"; git worktree remove --force "$WT" >/dev/null 2>&1; rm -rf "$BASE" >/dev/null 2>&1; }
trap cleanup EXIT

python3 "$DIR/patch_networkmap.py" "$WT" 2>&1 | tee -a "$LOG"
if [ "${PIPESTATUS[0]}" -ne 0 ]; then log "FAIL: patch aborted (no push)"; exit 1; fi

cd "$WT" || { log "FAIL: cd worktree"; exit 1; }
git add "app/api/agent/sub-agents/network/route.ts" "components/AgentNetworkMap.tsx"
if git diff --cached --quiet; then log "FAIL: nothing staged"; exit 1; fi

git -c user.name="Smarter-Poker" -c user.email="254329056+Smarter-Poker@users.noreply.github.com" \
  commit -m "Network Map: clickable cards, downline counts, and honest markup label

Three fixes to the Sub-Agent Network Map:
- Cards are now clickable and open the agent's full detail drawer.
- Each card shows how many agents and researchers sit under that agent
  (added agent_count/researcher_count to /api/agent/sub-agents/network).
- The per-card '% Rate' was actually commission_pct (the super's markup on
  that agent), which read as a sales/order rate and looked wrong with zero
  sales. Relabelled to '% Markup'.

Co-Authored-By: Claude <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_0179CVcR3FTXv1RGcR4ncsgV" 2>&1 | tee -a "$LOG" || { log "FAIL: commit"; exit 1; }

NEWSHA="$(git rev-parse HEAD)"
git push origin "HEAD:main" 2>&1 | tee -a "$LOG" || { log "FAIL: push (check credentials/network)"; exit 1; }
log "PUSHED $NEWSHA"
log "DEPLOY_OK"
