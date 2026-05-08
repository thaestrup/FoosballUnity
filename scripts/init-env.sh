#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TEMPLATE="$REPO_ROOT/.env.example"
TARGET="$REPO_ROOT/.env"

if [[ ! -f "$TEMPLATE" ]]; then
  echo "error: $TEMPLATE not found" >&2
  exit 1
fi

if [[ -e "$TARGET" ]]; then
  echo ".env already exists — leaving it untouched."
  exit 0
fi

cp "$TEMPLATE" "$TARGET"
echo "Created $TARGET from .env.example. Edit it to override defaults."
