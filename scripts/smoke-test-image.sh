#!/usr/bin/env bash
# Smoke test for the production image. First it runs the migration entry
# point (`node migrate.js`, Railway's pre-deploy command): it must migrate
# the database, do nothing on a second run, and exit non-zero without
# applying anything when a migration is broken. Then it starts a container,
# waits for its HEALTHCHECK and checks that Nest serves the API, the SPA and
# JSON 404s for unknown API routes, running as the `node` user and as PID 1
# without DATABASE_MIGRATION_URL in its environment, that the native argon2
# module works, and that writes are accepted only from APP_ORIGIN.
#
# Usage: DATABASE_URL="postgres://...?sslmode=disable" scripts/smoke-test-image.sh <image>
#
# DATABASE_MIGRATION_URL defaults to DATABASE_URL (in CI both are the
# Postgres service's owner). Use an empty or scratch database: it is migrated.
#
# The database must be reachable from the container: for one published on
# the host (Docker Compose, a CI service container) use host.docker.internal.
# SMOKE_PORT (default 3100) is the host port the container is published on.
# SMTP_URL, MAIL_FROM, APP_ORIGIN, CLIENT_IP_SOURCE, GOOGLE_CLIENT_ID and
# GOOGLE_CLIENT_SECRET are required in production; nothing is emailed and
# Google is not called during the smoke test, so they default to placeholders.
set -euo pipefail

image="${1:?Usage: $0 <image>}"
: "${DATABASE_URL:?DATABASE_URL is required}"
port="${SMOKE_PORT:-3100}"
export DATABASE_MIGRATION_URL="${DATABASE_MIGRATION_URL:-$DATABASE_URL}"
export SMTP_URL="${SMTP_URL:-smtp://smtp.invalid:587}"
export MAIL_FROM="${MAIL_FROM:-Mi consulta <no-reply@example.com>}"
export APP_ORIGIN="${APP_ORIGIN:-http://127.0.0.1:${port}}"
export CLIENT_IP_SOURCE="${CLIENT_IP_SOURCE:-socket}"
export GOOGLE_CLIENT_ID="${GOOGLE_CLIENT_ID:-smoke-test-client-id}"
export GOOGLE_CLIENT_SECRET="${GOOGLE_CLIENT_SECRET:-smoke-test-client-secret}"
container="nutri-smoke-$$"
base_url="http://127.0.0.1:${port}"
body="$(mktemp)"
migration_log="$(mktemp)"
broken_migrations="$(mktemp -d)"

cleanup() {
  local status=$?
  if [ "$status" -ne 0 ]; then
    echo '--- migration output ---'
    cat "$migration_log" 2>/dev/null || true
    echo '--- container logs ---'
    docker logs "$container" 2>&1 || true
  fi
  docker rm --force "$container" >/dev/null 2>&1 || true
  rm -rf "$body" "$migration_log" "$broken_migrations"
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

# migrate [docker run options]: runs `node migrate.js` as Railway's
# pre-deploy command does (same image, only its variable). Output goes to
# $migration_log; sets `migrate_status`.
migrate() {
  migrate_status=0
  docker run --rm \
    --add-host host.docker.internal:host-gateway \
    --env DATABASE_MIGRATION_URL \
    "$@" "$image" node migrate.js >"$migration_log" 2>&1 ||
    migrate_status=$?
}

migrate
[ "$migrate_status" = 0 ] ||
  fail "node migrate.js exited ${migrate_status} on the first run"
pass 'node migrate.js migrates the database'

migrate
[ "$migrate_status" = 0 ] ||
  fail "node migrate.js exited ${migrate_status} on the second run"
grep --quiet 'No pending migrations' "$migration_log" ||
  fail 'a second node migrate.js run was not a no-op'
pass 'a second node migrate.js run changes nothing'

# A copy of the image's migrations plus a broken one (a table, then a
# statement that fails), mounted over the image's folder. The image's own
# node writes the copy, so this needs nothing on the host.
docker run --rm --user "$(id -u):$(id -g)" \
  --volume "${broken_migrations}:/out" "$image" node -e "
    const fs = require('node:fs');
    fs.cpSync('migrations', '/out', { recursive: true });
    const file = '/out/meta/_journal.json';
    const journal = JSON.parse(fs.readFileSync(file, 'utf8'));
    const last = journal.entries.at(-1);
    journal.entries.push({ ...last, idx: last.idx + 1,
      when: last.when + 1, tag: '9999_smoke_broken' });
    fs.writeFileSync(file, JSON.stringify(journal));
    fs.writeFileSync('/out/9999_smoke_broken.sql',
      'CREATE TABLE smoke_partial (id integer);\n--> statement-breakpoint\n' +
      'ALTER TABLE smoke_missing_table ADD COLUMN x integer;');
  "
chmod -R a+rX "$broken_migrations"
migrate --volume "${broken_migrations}:/app/api/migrations:ro"
[ "$migrate_status" != 0 ] ||
  fail 'node migrate.js exited 0 with a broken migration'
grep --quiet 'code: 42P01' "$migration_log" ||
  fail 'a failed migration did not log its error code'
if grep --quiet 'smoke_' "$migration_log"; then
  fail 'a failed migration logged its SQL'
fi
broken_status="$migrate_status"
migrate
grep --quiet 'No pending migrations' "$migration_log" ||
  fail 'a broken migration was recorded as applied'
pass "a broken migration exits ${broken_status} and applies nothing"

# `--env NAME` forwards a variable without putting its value (a secret) on
# the command line. `host-gateway` makes host.docker.internal
# resolve on Linux too. During the image's start period the HEALTHCHECK runs
# every second instead of every 30 s; the check itself is the image's own.
docker run --detach --name "$container" \
  --add-host host.docker.internal:host-gateway \
  --publish "127.0.0.1:${port}:3000" \
  --env DATABASE_URL \
  --env DATABASE_MIGRATION_URL \
  --env SMTP_URL \
  --env MAIL_FROM \
  --env APP_ORIGIN \
  --env CLIENT_IP_SOURCE \
  --env GOOGLE_CLIENT_ID \
  --env GOOGLE_CLIENT_SECRET \
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

# Railway passes the service's variables to the app too, as above; the image's
# CMD removes the owner role's string, and node must stay PID 1 for SIGTERM.
# `comm` is node's thread name (MainThread); the command line names the binary.
[ "$(docker exec "$container" sh -c "tr '\0' '\n' </proc/1/cmdline | head -n 1")" = node ] ||
  fail 'node is not PID 1'
# Variable names only: the values are secrets.
app_env="$(docker exec "$container" sh -c "tr '\0' '\n' </proc/1/environ | cut -d= -f1")"
grep --quiet --line-regexp DATABASE_URL <<<"$app_env" ||
  fail 'could not read the app process environment'
if grep --quiet --line-regexp DATABASE_MIGRATION_URL <<<"$app_env"; then
  fail 'the app process can read DATABASE_MIGRATION_URL'
fi
pass 'the app runs as PID 1 without DATABASE_MIGRATION_URL'

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

# expect_write <origin> <status>: signing out without a session touches no
# table, so this needs no migrated database.
expect_write() {
  status="$(curl --silent --show-error --output /dev/null \
    --write-out '%{http_code}' --request POST --header "Origin: $1" \
    "${base_url}/api/auth/sign-out")"
  [ "$status" = "$2" ] ||
    fail "POST with Origin $1 returned ${status}, expected $2"
  pass "POST with Origin $1 -> ${status}"
}

expect_write "$APP_ORIGIN" 204
expect_write https://evil.example 403

echo 'Smoke test passed.'
