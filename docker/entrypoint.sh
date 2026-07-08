#!/bin/sh
# BALTHASAR simple-deploy entrypoint (013).
#
# Two modes, switched by BALTHASAR_ENTRYPOINT_MODE env var:
#   serve    (default) Wait for postgres → run migrations → start app (PID 1)
#   migrate            Wait for postgres → run migrations → exit 0/1 (CI/init container use)
#
# Migration failure (drizzle-kit non-zero exit) propagates as container exit 1,
# which combined with `restart: unless-stopped` lets the operator see the error
# in logs before deciding to intervene. See specs/013-simple-deploy/research.md Q3.

set -e

MODE="${BALTHASAR_ENTRYPOINT_MODE:-serve}"
PG_HOST="${POSTGRES_HOST:-postgres}"
PG_PORT="${POSTGRES_PORT_INTERNAL:-5432}"
PG_USER="${POSTGRES_USER:-balthasar}"

echo "[entrypoint] mode=${MODE} pg_host=${PG_HOST} tz=${TZ:-Asia/Shanghai}"

wait_for_postgres() {
  echo "[entrypoint] waiting for postgres at ${PG_HOST}:${PG_PORT} ..."
  attempts=0
  until pg_isready -h "${PG_HOST}" -p "${PG_PORT}" -U "${PG_USER}" -q; do
    attempts=$((attempts + 1))
    if [ "${attempts}" -gt 60 ]; then
      echo "[entrypoint] postgres not ready after 60s, giving up" >&2
      return 1
    fi
    sleep 1
  done
  echo "[entrypoint] postgres ready (after ${attempts}s)"
}

run_migrations() {
  echo "[entrypoint] running drizzle-kit migrate ..."
  node node_modules/drizzle-kit/bin.cjs migrate \
    --config=drizzle.config.ts
}

wait_for_postgres
run_migrations

case "${MODE}" in
  migrate)
    echo "[entrypoint] migrate-only mode, exiting"
    exit 0
    ;;
  serve)
    echo "[entrypoint] starting app (node server.js) ..."
    exec node server.js
    ;;
  *)
    echo "[entrypoint] unknown BALTHASAR_ENTRYPOINT_MODE: ${MODE}" >&2
    echo "  expected: 'serve' (default) or 'migrate'" >&2
    exit 1
    ;;
esac
