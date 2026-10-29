#!/usr/bin/env bash
# Smoke test for the production image: starts a container, waits for its
# HEALTHCHECK and checks that Nest serves the API, the SPA and JSON 404s for
# unknown API routes, running as the `node` user, and that the native argon2
# module works.
#
# Usage: DATABASE_URL=postgres://... scripts/smoke-test-image.sh <image>
#
# The database must be reachable from the container: for one published on
# the host (Docker Compose, a CI service container) use host.docker.internal.
# SMOKE_PORT (default 3100) is the host port the container is published on.
# SMTP_URL, MAIL_FROM, APP_ORIGIN and CLIENT_IP_SOURCE are required in
# production; nothing is emailed during the smoke test, so they default to
# placeholders.
set -euo pipefail

image="${1:?Usage: $0 <image>}"
: "${DATABASE_URL:?DATABASE_URL is required}"
port="${SMOKE_PORT:-3100}"
export SMTP_URL="${SMTP_URL:-smtp://smtp.invalid:587}"
export MAIL_FROM="${MAIL_FROM:-Mi consulta <no-reply@example.com>}"
export APP_ORIGIN="${APP_ORIGIN:-http://127.0.0.1:${port}}"
export CLIENT_IP_SOURCE="${CLIENT_IP_SOURCE:-socket}"
container="nutri-smoke-$$"
base_url="http://127.0.0.1:${port}"
body="$(mktemp)"

cleanup() {
  local status=$?
  if [ "$status" -ne 0 ]; then
    echo '--- container logs ---'
    docker logs "$container" 2>&1 || true
  fi
  docker rm --force "$container" >/dev/null 2>&1 || true
  rm -f "$body"
  exit "$status"
}
trap cleanup EXIT

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

pass() {
  echo "ok: $*"
}

# `--env NAME` forwards a variable without putting its value (a secret) on
# the command line. `host-gateway` makes host.docker.internal
# resolve on Linux too. During the image's start period the HEALTHCHECK runs
# every second instead of every 30 s; the check itself is the image's own.
docker run --detach --name "$container" \
  --add-host host.docker.internal:host-gateway \
  --publish "127.0.0.1:${port}:3000" \
  --env DATABASE_URL \
  --env SMTP_URL \
  --env MAIL_FROM \
  --env APP_ORIGIN \
  --env CLIENT_IP_SOURCE \
  --health-start-interval 1s \
  "$image" >/dev/null

echo 'Waiting for the container HEALTHCHECK...'
health=starting
for _ in $(seq 1 60); do
  if [ "$(docker inspect --format '{{.State.Running}}' "$container")" != true ]; then
    fail 'container exited before becoming healthy'
  fi
  health="$(docker inspect --format '{{.State.Health.Status}}' "$container")"
  case "$health" in
    healthy) break ;;
    unhealthy) fail 'container reported unhealthy' ;;
  esac
  sleep 1
done
[ "$health" = healthy ] || fail "container still '${health}' after 60 s"
pass 'container is healthy'

[ "$(docker image inspect --format '{{.Config.User}}' "$image")" = node ] ||
  fail 'image config does not set USER node'
[ "$(docker exec "$container" id -un)" = node ] ||
  fail 'container process does not run as node'
[ "$(docker exec "$container" id -u)" != 0 ] ||
  fail 'container process runs as root'
pass 'runs as the node user'

# argon2 is a native module: prove its prebuilt binary loads on Alpine (musl)
# and hashes, without needing a migrated database.
docker exec --workdir /app/api "$container" node -e "
  const argon2 = require('argon2');
  argon2.hash('smoke', { type: argon2.argon2id })
    .then((hash) => argon2.verify(hash, 'smoke'))
    .then((ok) => process.exit(ok ? 0 : 1), () => process.exit(1));
" || fail 'argon2 does not hash and verify inside the image'
pass 'argon2 hashes and verifies'

# Requests a path; sets `status` and `content_type`, the body goes to $body.
request() {
  local result
  result="$(curl --silent --show-error --output "$body" \
    --write-out '%{http_code} %{content_type}' "${base_url}$1")"
  status="${result%% *}"
  content_type="${result#* }"
}

# expect <path> <status> <content type prefix> <text the body contains>
expect() {
  request "$1"
  [ "$status" = "$2" ] || fail "GET $1 returned ${status}, expected $2"
  [[ "$content_type" == "$3"* ]] ||
    fail "GET $1 returned '${content_type}', expected $3"
  grep --quiet --fixed-strings -- "$4" "$body" ||
    fail "GET $1 body does not contain '$4'"
  pass "GET $1 -> ${status} ${3}"
}

expect /api/health 200 application/json '"status":"ok"'
expect / 200 text/html '<div id="root">'
# Deep links fall back to the SPA's index.html.
expect /patients 200 text/html '<div id="root">'
expect /api/does-not-exist 404 application/json '"code":"NOT_FOUND"'
if grep --quiet --fixed-strings '<div id="root">' "$body"; then
  fail 'GET /api/does-not-exist returned the SPA'
fi

echo 'Smoke test passed.'
