# MLB-ANALYTICS Engine — Continuation Handoff (2026-07-05)

You are continuing work on a deterministic MLB prediction/betting engine. The system was rebuilt across
many sessions and is now functional, self-learning, and gate-honest. Your job is to VERIFY current state
first, then work the open punch list. Do not re-do completed work — verify against live state before acting.

## STEP 0 — READ THIS FIRST
- Read the memory file: `spaces/.../memory/mlb-analytics-audit-2026-07-04.md` (all sessions logged there).
- The engine is REAL-MONEY-ADJACENT. Never emit a BET rec for an unproven/prohibited market. Never
  hardcode a probability-shrink coefficient the backtest hasn't validated (a prior swarm OOS-tested a
  totals shrink and it FAILED — the self-learning auto_gate handles market promotion/demotion instead).
- Discipline: fix + verify with a live query/test before claiming done. One measured CLV point at a time.

## INFRASTRUCTURE (all verified)
- Engine repo (edit path): `/Users/smarter.poker/mlb-analytics-engine`  (bash mount: `/sessions/.../mnt/smarter.poker--mlb-analytics-engine`)
- Web repo (edit path): `/Users/smarter.poker/Documents/Smarter-Poker-World-Hub` (MLB surface: `pages/hub/MLB-ANALYTICS/*` + `pages/api/mlb/*`)
- Pipeline host: HETZNER `root@5.161.252.33` via `~/.ssh/hetzner_key` (create from HETZNER-SSH-KEYS.md if missing). systemd timers: mlb-nightly (06:00 CT), mlb-noon, mlb-pregame (15:30), mlb-intraday+mlb-update (every 15m), mlb-postclose, mlb-retrain, mlb-backtest.
- Engine code path on host: `/opt/mlb-analytics-engine`. venv has NO pip — use `/root/.local/bin/uv pip install --python /opt/mlb-analytics-engine/.venv/bin/python <pkg>`.
- Supabase (engine DB) REST: `https://nscdmxldtyszyvcxxwgr.supabase.co/rest/v1/` — service key + management token are in `deploy/mlb.env` on the host and in the memory file. Use REST for reads, management API (`https://api.supabase.com/v1/projects/nscdmxldtyszyvcxxwgr/database/query`) ONLY for `ADD COLUMN IF NOT EXISTS` / `CREATE TABLE IF NOT EXISTS`.
- GIT: the mounted repos have BROKEN git locks — do NOT `git commit/push` from the mount. Push via GitHub API using the PAT in `deploy/mlb.env` (create blobs -> tree -> commit -> PATCH ref). Then on Hetzner: `cd /opt/mlb-analytics-engine && git stash -q; git pull -q --no-rebase`. Web deploys auto-build on Vercel (project hub-vanguard); verify via the Vercel MCP list_deployments/get_deployment and by hitting the live API.
- Live site: `https://smarter.poker/hub/MLB-ANALYTICS` (native World Hub pages, NOT the engine's own Vercel app which is account-blocked). Card API: `https://smarter.poker/api/mlb/best-bets`.
- A GateGuard hook may block Edit/Write until you present facts (grep importers, affected funcs, data shapes, quote the user instruction). Comply and retry.

## STEP 1 — VERIFY CURRENT HEALTH (do these before any change)
1. Nightly finished cleanly: `ssh ... "journalctl -u mlb-nightly.service -n 3000 --no-pager | grep '\[daily\] ' | tail"` — expect evaluate/heal/ingest/compute/enrich/predict/push/grade/auto_gate/clv_report all OK, ending `[daily] DONE`. (Known slow stage: enrich, per-player fetches via relay.)
2. Ingest is fast now (WAF circuit breaker): ingest should be minutes, not hours. If it regresses to hours, the breaker or relay broke — check `engine/common/http.py` `_WAF_STATE` and `MLB_RELAY_URL/MLB_RELAY_KEY` in mlb.env.
3. Card is gate-honest: `curl -s https://smarter.poker/api/mlb/best-bets | python3 -c "..."` — bets should be ONLY markets the engine flagged (currently h2h/run_line/total), every row `gate_status:'bet'`, ZERO prohibited markets (team_total/nrfi/f5_*).
4. No prohibited BETs in DB: query pred_market_output for market in (team_total,nrfi,f5_total,f5_team_total,f5_moneyline) with rec ILIKE '%BET%' excluding NO BET/MODEL ONLY -> must be 0. (run_line is PROMOTED to a 2.0 floor and is legitimately bettable — do not suppress it.)
5. gate_config.json is fresh: `cat /opt/mlb-analytics-engine/engine/model/gate_config.json` — check `generated_at` is from the latest nightly, and that `basis`/`kelly_scale` fields are now populated (they were null on the 06:46 config; tonight's auto_gate should write them).
6. data_sentinel + clv_report ran: check pipeline_runs / clv_weekly table for today.

## OPEN PUNCH LIST (ranked; verify each is still open first)

### A. DISPLAY-TIER (data exists, just not surfaced) — low risk, do first
1. Surface `price_ts` (quote age) on the bet card. Columns `pred_market_output.price_ts` + `pred_props.price_ts` are ADDED and POPULATING (stamped in run_intraday.fill_best_prices/fill_prop_prices from the winning book's knowledge_time). Add it to the best-bets API select + render "quote age: N min" on `best-bets.tsx` cards; grey out / warn if the quote is >15 min stale.
2. Surface gate `basis` (profit vs clv-provisional) and `kelly_scale` on the card so a provisional/half-Kelly bet is visibly marked. Source is `gate_config.json` (engine-only today). Cleanest path: have auto_gate also write basis/kelly_scale INTO pred rows (or a small gate_status table the API can join), then display a badge.

### B. MODEL / EDGE (the real profitability work) — needs evidence, be rigorous
3. Totals over-skew: sim P(over) still ~0.57 vs market ~0.50 on total rows (improved from 68%->~55% of O/U flags via physics+calibrator, currently FLAT not losing). Do NOT hardcode a shrink. Instead: after >=2 weeks of clean graded totals, re-check the totals calibrator's fit on `raw_model_prob` and let auto_gate demote total if CLV/ROI turns negative. Investigate whether a residual sim run-environment level bias remains (compare sim mean total vs realized mean total on 2026 finals).
4. CLV is the north star, not win%/ROI. Build/verify the weekly CLV report is landing in `clv_weekly` and wire a scheduled digest (per market + per book — betrivers was +2.09 pts, betonlineag -0.67; line-shop toward soft books). Add CLV to `/model-intel` and `/validation` pages so the operator watches the real signal.
5. Prop markets are ALL suppressed pending sample (pitcher_strikeouts is closest: ~+0.20u/bet, will self-promote around n=150). Verify auto_gate promotes them correctly as graded samples accrue; confirm the granularity fixes (SmoothedIsotonic, per-player SB/hits) produce VARIED probs now (no more constant 0.5677 / plateau-clustering).
6. Decompose price-edge vs model-edge in the Bet Score (line-shopping profit != model skill; size them differently). Roadmap item #20.

### C. DATA COMPLETENESS (bigger builds, highest ceiling on accuracy)
7. Pitch-type-vs-batter arsenal matchups (#2): a `pitch_arsenal.py` transformer exists (3-class K multiplier). Verify it's wired into the sim and pulling live Savant arsenal data, then extend beyond K (contact/HR by pitch type).
8. Catcher framing/blocking by personnel (#1): catcher-defense block exists but historically ran on neutral defaults; the savant leaderboard wiring was added — VERIFY it's feeding real framing/CS numbers into the sim, not defaults.
9. Rookie/callup priors (#7): `<50 PA/BF` players get a league-shifted rookie prior — verify it fires for debuts and doesn't crash on empty-metric actives.
10. Adaptive sims (#14): `simulate_game(adaptive=True)` runs 4k-20k blocks with CI stopping — verify blowouts run fewer sims and coin-flips run more, and reproducibility holds.
11. SGP correlation (#15): `joint_corr_matrix` is persisted to sgp_cache + explainability. Build the downstream correlated-parlay pricing surface (do not just leave the matrix unused).
12. Live in-game repricing (#26): design-sketch only in the roadmap — the sim can price mid-game states; scope this as a future surface, don't build blind.

### D. KNOWN LOOSE ENDS
13. Unattributed live-ingest `team_total` writer: prior sessions saw the live_ingest->daily_predict(live=True) path emit a few alternate-line team_total rows. Now CONTAINED by three guards (write-time prohibitive-floor guard in daily_predict.row(), reprice force-correction, sweep) + web filter, but the WRITER itself was never pinned down. Root-cause it if team_total BET rows ever reappear.
14. Backtest window has a permanent hole 6/30-7/3 (pipeline was down, closing odds unrecoverable). The 2026 baseline (backtest_market_output, ~11.5k rows, 3/26-6/22 on fixed code) is the reference. Don't try to backfill the hole — it's gone.
15. Scratch files on the mount that can't be deleted from sandbox (SWARM-BRIEF.md redacted stub, data/sgp_cache/999999999.json test artifact, engine/pipeline/.dp_decoded_tmp.py) — delete from the Mac when convenient; harmless.

## VERIFICATION STANDARD FOR EVERY CHANGE
- `python3 -m py_compile <file>` for engine; `ts.createSourceFile parseDiagnostics==0` for web (via `node ./node_modules/typescript`).
- Run the relevant `engine/tests/test_*.py` (assert-based, run directly; venv lacks pytest).
- Live-query the DB/API to prove the fix landed. For pipeline changes, run just that stage on Hetzner
  (`cd engine && set -a && source ../deploy/mlb.env && set +a && ../.venv/bin/python -c "..."`).
- Push via GitHub API, sync Hetzner, verify web via Vercel deploy READY + live API. No emoji anywhere.
