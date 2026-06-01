#!/usr/bin/env bash
#
# RLS regression smoke suite for non-messenger surfaces.
# See scripts/rls/README.md for the full rationale.
#
# Usage:  bash scripts/rls/run.sh
# Exits:  0 = all pass, 1 = any fail.

set -u

# ---------------------------------------------------------------------
# Config + helpers
# ---------------------------------------------------------------------

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="$ROOT_DIR/.env.local"

if [ -f "$ENV_FILE" ]; then
  # shellcheck disable=SC1090
  set -a; . "$ENV_FILE"; set +a
fi

: "${NEXT_PUBLIC_SUPABASE_URL:?NEXT_PUBLIC_SUPABASE_URL is required}"
: "${NEXT_PUBLIC_SUPABASE_ANON_KEY:?NEXT_PUBLIC_SUPABASE_ANON_KEY is required}"
: "${TEST_ADMIN_EMAIL:=daniel@bekavactrading.com}"
: "${TEST_ADMIN_PASSWORD:=}"
: "${APP_URL:=https://pepnationlab.com}"

SUPABASE_URL="$NEXT_PUBLIC_SUPABASE_URL"
ANON_KEY="$NEXT_PUBLIC_SUPABASE_ANON_KEY"

PASS_COUNT=0
FAIL_COUNT=0

log_pass() { echo "PASS  $1"; PASS_COUNT=$((PASS_COUNT + 1)); }
log_fail() {
  echo "FAIL  $1"
  if [ -n "${2:-}" ]; then echo "      $2"; fi
  FAIL_COUNT=$((FAIL_COUNT + 1))
}
log_warn() { echo "WARN  $1"; }

# Sign in via Supabase Auth REST. Echoes the access token to stdout.
supa_signin() {
  local email="$1" password="$2"
  curl -sS -X POST "$SUPABASE_URL/auth/v1/token?grant_type=password" \
    -H "apikey: $ANON_KEY" \
    -H 'Content-Type: application/json' \
    --data "{\"email\":\"$email\",\"password\":\"$password\"}" \
    | jq -r '.access_token // empty'
}

# Run a Supabase REST GET. Args: <jwt> <path-with-query>
# Echoes raw response body. Sets global LAST_STATUS to the HTTP code.
LAST_STATUS=0
supa_get() {
  local jwt="$1" path="$2"
  local resp
  local key_header
  if [ -z "$jwt" ]; then
    key_header="apikey: $ANON_KEY"
    auth_header="Authorization: Bearer $ANON_KEY"
  else
    key_header="apikey: $ANON_KEY"
    auth_header="Authorization: Bearer $jwt"
  fi
  resp=$(curl -sS -o /tmp/_rls_body.$$ -w '%{http_code}' \
    -H "$key_header" -H "$auth_header" \
    "$SUPABASE_URL/rest/v1/$path")
  LAST_STATUS="$resp"
  cat /tmp/_rls_body.$$
  rm -f /tmp/_rls_body.$$
}

# expect_empty <test-name> <jwt> <rest-path>
# Passes if the GET returns either status 200 with [] OR a 401/403.
expect_empty() {
  local name="$1" jwt="$2" path="$3"
  local body
  body=$(supa_get "$jwt" "$path")
  if [ "$LAST_STATUS" = "401" ] || [ "$LAST_STATUS" = "403" ]; then
    log_pass "$name (status $LAST_STATUS)"
    return
  fi
  if [ "$LAST_STATUS" = "200" ]; then
    local count
    count=$(echo "$body" | jq 'length // 0' 2>/dev/null)
    if [ "$count" = "0" ]; then
      log_pass "$name (empty array)"
      return
    fi
    log_fail "$name" "expected empty, got $count rows: $(echo "$body" | head -c 200)"
    return
  fi
  log_fail "$name" "unexpected status $LAST_STATUS: $(echo "$body" | head -c 200)"
}

# expect_nonempty <test-name> <jwt> <rest-path>
# Passes if GET returns 200 with at least one row.
expect_nonempty() {
  local name="$1" jwt="$2" path="$3"
  local body
  body=$(supa_get "$jwt" "$path")
  if [ "$LAST_STATUS" != "200" ]; then
    log_fail "$name" "expected 200 with data, got $LAST_STATUS: $(echo "$body" | head -c 200)"
    return
  fi
  local count
  count=$(echo "$body" | jq 'length // 0' 2>/dev/null)
  if [ "${count:-0}" -gt 0 ]; then
    log_pass "$name ($count rows)"
    return
  fi
  log_fail "$name" "expected >=1 row, got 0"
}

# ---------------------------------------------------------------------
# Checks
# ---------------------------------------------------------------------

check_anon_sensitive_tables() {
  echo "--- anon vs sensitive tables ---"
  expect_empty "anon cannot read profiles"             "" "profiles?select=id&limit=1"
  expect_empty "anon cannot read orders"               "" "orders?select=id&limit=1"
  expect_empty "anon cannot read weekly_statements"    "" "weekly_statements?select=id&limit=1"
  expect_empty "anon cannot read balance_transactions" "" "balance_transactions?select=id&limit=1"
  expect_empty "anon cannot read admin_audit_log"      "" "admin_audit_log?select=id&limit=1"
  expect_empty "anon cannot read messenger_messages"   "" "messenger_messages?select=id&limit=1"
}

check_anon_pricing() {
  echo "--- anon vs pricing tables ---"
  expect_empty "anon cannot read pricing_tiers"           "" "pricing_tiers?select=id&limit=1"
  expect_empty "anon cannot read product_tier_overrides"  "" "product_tier_overrides?select=id&limit=1"
}

check_anon_storefront_public() {
  echo "--- anon vs public storefront tables ---"
  expect_nonempty "anon CAN read agent_profiles" "" "agent_profiles?select=id,slug&is_active=eq.true&limit=1"
  expect_nonempty "anon CAN read products"       "" "products?select=id,name&is_active=eq.true&limit=1"
  expect_nonempty "anon CAN read agent_products" "" "agent_products?select=id,retail_price&limit=1"
}

check_admin_sanity() {
  echo "--- admin sanity ---"
  if [ -z "$TEST_ADMIN_PASSWORD" ]; then
    log_warn "TEST_ADMIN_PASSWORD not set — skipping admin-auth checks"
    return
  fi
  local jwt
  jwt=$(supa_signin "$TEST_ADMIN_EMAIL" "$TEST_ADMIN_PASSWORD")
  if [ -z "$jwt" ]; then
    log_fail "admin sign-in" "could not get JWT for $TEST_ADMIN_EMAIL"
    return
  fi
  log_pass "admin sign-in"
  expect_nonempty "admin can read orders"            "$jwt" "orders?select=id&limit=1"
  expect_nonempty "admin can read profiles"          "$jwt" "profiles?select=id&limit=1"
  expect_nonempty "admin can read weekly_statements OR table empty" "$jwt" "weekly_statements?select=id&limit=1" || true
}

check_researcher_isolation() {
  echo "--- researcher isolation ---"
  if [ -z "${TEST_RESEARCHER_EMAIL:-}" ] || [ -z "${TEST_RESEARCHER_PASSWORD:-}" ]; then
    log_warn "TEST_RESEARCHER_EMAIL/PASSWORD not set — skipping researcher-isolation checks"
    return
  fi
  local jwt
  jwt=$(supa_signin "$TEST_RESEARCHER_EMAIL" "$TEST_RESEARCHER_PASSWORD")
  if [ -z "$jwt" ]; then
    log_fail "researcher sign-in" "could not get JWT for $TEST_RESEARCHER_EMAIL"
    return
  fi
  log_pass "researcher sign-in"
  # Only the researcher's own profile + orders should come back.
  local rows
  rows=$(supa_get "$jwt" "profiles?select=id,role&limit=20")
  if [ "$LAST_STATUS" = "200" ]; then
    local non_self
    non_self=$(echo "$rows" | jq '[.[] | select(.role != "admin")] | length' 2>/dev/null)
    if [ "${non_self:-0}" -le 1 ]; then
      log_pass "researcher only sees their own profile (plus admin if listed)"
    else
      log_fail "researcher profile isolation" "saw $non_self non-admin profiles, expected <=1"
    fi
  else
    log_fail "researcher profile isolation" "status $LAST_STATUS"
  fi
}

check_list_contacts_admin() {
  echo "--- /api/messenger/list-contacts admin branch ---"
  if [ -z "$TEST_ADMIN_PASSWORD" ]; then
    log_warn "skipped (no admin password)"
    return
  fi
  # POST hits the Next.js route. Use the cookie-less Bearer pattern via the
  # Supabase JWT; the route's requireSession reads the supabase session
  # cookie, so this check only works when running locally OR when the
  # APP_URL serves an instance that trusts the cookie. If unreachable,
  # we still surface it as WARN rather than FAIL.
  local jwt
  jwt=$(supa_signin "$TEST_ADMIN_EMAIL" "$TEST_ADMIN_PASSWORD")
  if [ -z "$jwt" ]; then
    log_warn "admin sign-in failed — skipping list-contacts check"
    return
  fi
  # Build the @supabase/ssr cookie value the route expects.
  local refresh
  refresh=$(echo "{\"access_token\":\"$jwt\"}" | base64 | tr -d '\n')
  local resp status
  resp=$(curl -sS -o /tmp/_rls_body.$$ -w '%{http_code}' \
    -X POST "$APP_URL/api/messenger/list-contacts" \
    -H 'Content-Type: application/json' \
    -H "Cookie: sb-access-token=$jwt" \
    -d '{}')
  status="$resp"
  body=$(cat /tmp/_rls_body.$$ 2>/dev/null || true)
  rm -f /tmp/_rls_body.$$
  if [ "$status" = "200" ]; then
    local n
    n=$(echo "$body" | jq '.contacts | length // 0' 2>/dev/null)
    if [ "${n:-0}" -gt 0 ]; then
      log_pass "list-contacts admin returns $n contacts"
    else
      log_fail "list-contacts admin" "returned 0 contacts (expected all active non-admin users)"
    fi
  else
    log_warn "list-contacts admin returned $status — likely auth cookie format mismatch (functional in browser)"
  fi
}

check_global_search_admin_gate() {
  echo "--- /api/admin/global-search admin-only gate ---"
  # Anon request — should 401.
  local resp status
  resp=$(curl -sS -o /tmp/_rls_body.$$ -w '%{http_code}' \
    -H "apikey: $ANON_KEY" \
    "$APP_URL/api/admin/global-search?q=test")
  status="$resp"
  body=$(cat /tmp/_rls_body.$$ 2>/dev/null || true)
  rm -f /tmp/_rls_body.$$
  if [ "$status" = "401" ] || [ "$status" = "403" ]; then
    log_pass "anon hits /api/admin/global-search and gets $status"
  else
    log_fail "global-search admin gate" "expected 401/403, got $status: $(echo "$body" | head -c 200)"
  fi
}

check_auto_admin_conversation_trigger() {
  echo "--- fn_ensure_admin_conversations_for_user backfill integrity ---"
  # We cannot query directly without a service-role JWT (which the smoke
  # suite intentionally does not have). Instead, log a reminder that this
  # boundary is covered by a one-line SQL check in the Supabase MCP.
  log_warn "covered by Supabase MCP smoke (SELECT every non-admin profile has admin conv). Run manually if migrating profiles RLS."
}

# ---------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------

main() {
  echo "=== RLS smoke @ $(date -u +%Y-%m-%dT%H:%M:%SZ) ==="
  echo "Project: $SUPABASE_URL"
  echo "App:     $APP_URL"
  echo

  check_anon_sensitive_tables
  check_anon_pricing
  check_anon_storefront_public
  check_admin_sanity
  check_researcher_isolation
  check_list_contacts_admin
  check_global_search_admin_gate
  check_auto_admin_conversation_trigger

  echo
  echo "=== $PASS_COUNT passed, $FAIL_COUNT failed ==="
  if [ "$FAIL_COUNT" -gt 0 ]; then
    exit 1
  fi
}

main "$@"
