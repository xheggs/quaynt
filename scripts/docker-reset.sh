#!/usr/bin/env bash
# Quaynt — Reset Docker development environment
#
# Stops all containers, removes volumes (including PostgreSQL data),
# rebuilds images, and restarts PostgreSQL.
#
# Usage:
#   bash scripts/docker-reset.sh         — interactive (prompts before deleting)
#   bash scripts/docker-reset.sh --yes   — skip confirmation prompt

set -euo pipefail

SKIP_PROMPT=false

for arg in "$@"; do
  case "$arg" in
    --yes|-y) SKIP_PROMPT=true ;;
    *) echo "Unknown option: $arg"; exit 1 ;;
  esac
done

if [ "$SKIP_PROMPT" = false ]; then
  echo "This will delete all PostgreSQL data and rebuild Docker images."
  read -rp "Continue? [y/N] " confirm
  case "$confirm" in
    [yY]|[yY][eE][sS]) ;;
    *) echo "Aborted."; exit 0 ;;
  esac
fi

echo "Stopping containers (default + dev profile)..."
docker compose --profile dev down -v || true

echo "Rebuilding images..."
docker compose build || true

echo "Starting PostgreSQL..."
docker compose up -d

echo "Waiting for PostgreSQL to be healthy..."
for i in $(seq 1 30); do
  if docker compose ps --format '{{.Status}}' 2>/dev/null | grep -q "healthy"; then
    echo "Done. PostgreSQL is healthy."
    exit 0
  fi
  sleep 1
done

echo "Warning: PostgreSQL did not become healthy within 30 seconds."
echo "Check logs with: docker compose logs db"
exit 1
