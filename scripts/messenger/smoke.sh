#!/usr/bin/env bash
# ============================================================================
# Messenger Smoke Test (Phase 15)
# ----------------------------------------------------------------------------
# Hits every messenger surface area against the target host (production by
# default) without credentials. Every authenticated route must return 401
# Unauthorized — that's the smoke signal that:
#
#   * the route is deployed and reachable,
#   * CSRF + session gates fire before any DB work,
#   * the rate limiter shipped in Phase 15 hasn't broken the auth gate.
#
# Run:
#
#   bash scripts/messenger/smoke.sh
#
# Or against an alternative host:
#
#   BASE_URL=https://staging.pepnationlab.com bash scripts/messenger/smoke.sh
#
# Exit code = number of failed checks (0 == all green).
# ============================================================================

set -u
BASE="${BASE_URL:-https://pepnationlab.com}"

PASS=0
FAIL=0

check() {
  local desc="$1"
  local expected="$2"
  local actual="$3"
  if [[ "$actual" == "$expected" ]]; then
    printf 'PASS  %-60s %s\n' "$desc" "$actual"
    PASS=$((PASS+1))
  else
    printf 'FAIL  %-60s expected=%s got=%s\n' "$desc" "$expected" "$actual"
    FAIL=$((FAIL+1))
  fi
}

# smoke_endpoint METHOD PATH EXPECTED_STATUS DESCRIPTION
smoke_endpoint() {
  local method="$1"
  local path="$2"
  local expected="$3"
  local desc="$4"
  local actual
  actual=$(curl -s -o /dev/null -w "%{http_code}" -X "$method" \
    -H "content-type: application/json" \
    --data-raw '{}' \
    --max-time 15 \
    "$BASE$path" 2>/dev/null || echo "000")
  check "$desc" "$expected" "$actual"
}

echo "=== Phase 15 Messenger Smoke ==="
echo "Target: $BASE"
echo

echo "--- Liveness ---"
status=$(curl -s -o /dev/null -w "%{http_code}" --max-time 15 "$BASE/api/health" 2>/dev/null || echo "000")
check "/api/health returns 200" "200" "$status"

echo
echo "--- Phase 2 Core ---"
smoke_endpoint POST /api/messenger/get-conversations    401 "get-conversations gated"
smoke_endpoint POST /api/messenger/get-messages         401 "get-messages gated"
smoke_endpoint POST /api/messenger/send-message         401 "send-message gated"
smoke_endpoint POST /api/messenger/start-conversation   401 "start-conversation gated"
smoke_endpoint POST /api/messenger/mark-read            401 "mark-read gated"
smoke_endpoint POST /api/messenger/list-contacts        401 "list-contacts gated"

echo
echo "--- Phase 5 Reactions/Edit/Delete ---"
smoke_endpoint POST /api/messenger/react-message        401 "react-message gated"
smoke_endpoint POST /api/messenger/edit-message         401 "edit-message gated"
smoke_endpoint POST /api/messenger/delete-message       401 "delete-message gated"

echo
echo "--- Phase 6 Realtime helpers ---"
smoke_endpoint POST /api/messenger/update-presence      401 "update-presence gated"

echo
echo "--- Phase 7 Media ---"
smoke_endpoint POST /api/messenger/upload-media         401 "upload-media gated"
smoke_endpoint POST /api/messenger/gif-search           401 "gif-search gated"
smoke_endpoint POST /api/messenger/link-preview         401 "link-preview gated"

echo
echo "--- Phase 8 Search ---"
smoke_endpoint POST /api/messenger/search-messages      401 "search-messages gated"
smoke_endpoint POST /api/messenger/global-search        401 "global-search gated"

echo
echo "--- Phase 9 Groups ---"
smoke_endpoint POST /api/messenger/add-participant      401 "add-participant gated"
smoke_endpoint POST /api/messenger/remove-participant   401 "remove-participant gated"
smoke_endpoint POST /api/messenger/set-participant-role 401 "set-participant-role gated"
smoke_endpoint POST /api/messenger/leave-conversation   401 "leave-conversation gated"
smoke_endpoint POST /api/messenger/list-participants    401 "list-participants gated"
smoke_endpoint POST /api/messenger/mute-conversation    401 "mute-conversation gated"
smoke_endpoint POST /api/messenger/archive-conversation 401 "archive-conversation gated"

echo
echo "--- Phase 10 Premium UX ---"
smoke_endpoint POST /api/messenger/pin-message          401 "pin-message gated"
smoke_endpoint POST /api/messenger/list-pins            401 "list-pins gated"
smoke_endpoint POST /api/messenger/bookmark-message     401 "bookmark-message gated"
smoke_endpoint POST /api/messenger/list-bookmarks       401 "list-bookmarks gated"
smoke_endpoint POST /api/messenger/label-message        401 "label-message gated"
smoke_endpoint POST /api/messenger/list-labels          401 "list-labels gated"
smoke_endpoint POST /api/messenger/set-theme            401 "set-theme gated"
smoke_endpoint POST /api/messenger/get-theme            401 "get-theme gated"
smoke_endpoint POST /api/messenger/schedule-message     401 "schedule-message gated"
smoke_endpoint POST /api/messenger/list-scheduled       401 "list-scheduled gated"
smoke_endpoint POST /api/messenger/thread-reply         401 "thread-reply gated"
smoke_endpoint POST /api/messenger/list-thread-replies  401 "list-thread-replies gated"
smoke_endpoint POST /api/messenger/template             401 "template gated"
smoke_endpoint POST /api/messenger/list-templates       401 "list-templates gated"

echo
echo "--- Phase 11 Calls ---"
smoke_endpoint POST /api/messenger/call-signal          401 "call-signal gated"
smoke_endpoint POST /api/messenger/livekit-token        401 "livekit-token gated"
smoke_endpoint POST /api/messenger/list-active-calls    401 "list-active-calls gated"

echo
echo "--- Phase 12 Safety ---"
smoke_endpoint POST /api/messenger/block-user           401 "block-user gated"
smoke_endpoint POST /api/messenger/list-blocks          401 "list-blocks gated"
smoke_endpoint POST /api/messenger/report-message       401 "report-message gated"

echo
echo "--- Phase 13 Intelligence ---"
smoke_endpoint POST /api/messenger/reminder             401 "reminder gated"
smoke_endpoint POST /api/messenger/cancel-reminder      401 "cancel-reminder gated"
smoke_endpoint POST /api/messenger/list-reminders       401 "list-reminders gated"

echo
echo "--- Phase 14 Notifications ---"
smoke_endpoint POST /api/messenger/notification-prefs   401 "notification-prefs gated"

echo
echo "--- Phase 13 Crons (Bearer-gated) ---"
smoke_endpoint GET /api/messenger/cron/process-scheduled 401 "process-scheduled cron unauth=401"
smoke_endpoint GET /api/messenger/cron/fire-reminders    401 "fire-reminders cron unauth=401"
smoke_endpoint GET /api/messenger/cron/expire-messages   401 "expire-messages cron unauth=401"

echo
echo "--- Phase 12 Admin Moderation ---"
smoke_endpoint POST /api/admin/messenger/list-reports         401 "admin list-reports gated"
smoke_endpoint POST /api/admin/messenger/resolve-report       401 "admin resolve-report gated"
smoke_endpoint POST /api/admin/messenger/list-admin-mentions  401 "admin list-admin-mentions gated"
smoke_endpoint POST /api/admin/messenger/resolve-mention      401 "admin resolve-mention gated"
smoke_endpoint POST /api/admin/messenger/delete-message       401 "admin delete-message gated"

echo
echo "--- Pages ---"
status=$(curl -s -o /dev/null -w "%{http_code}" --max-time 15 "$BASE/messenger" 2>/dev/null || echo "000")
check "/messenger redirects unauthenticated" "307" "$status"
status=$(curl -s -o /dev/null -w "%{http_code}" --max-time 15 "$BASE/admin/messenger" 2>/dev/null || echo "000")
check "/admin/messenger redirects unauthenticated" "307" "$status"

echo
echo "============================================"
echo "Results: $PASS pass / $FAIL fail"
echo "============================================"
exit $FAIL
